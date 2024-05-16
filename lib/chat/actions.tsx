import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { openai } from '@ai-sdk/openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage
} from '@/components/appointments'

import { z } from 'zod'
import {
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/appointments/message'
import { Chat } from '@/lib/types'
import { auth } from '@/auth'
import { AppointmentSlots } from '@/components/appointments/appointment-slots'

async function confirmAppointment(appointmentSlot: {id: number, time: string, durationMinutes: number, doctor: string}) {
  'use server'

  const {id, time, durationMinutes, doctor} = appointmentSlot;
  const aiState = getMutableAIState<typeof AI>()

  const selecting = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Selecting appointment {id} ...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    selecting.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Selecting appointment {id} ... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    selecting.done(
      <div>
        <p className="mb-2">
          You have successfully selected appointment {id}.
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have selected appointment {id}
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages.slice(0, -1),
        {
          id: nanoid(),
          role: 'function',
          name: 'showSelectedAppointment',
          content: JSON.stringify({
            id,
            time,
            durationMinutes,
            doctor,
            status: 'completed'
          })
        },
        {
          id: nanoid(),
          role: 'system',
          content: `[User has selected appointment with id ${id}]`
        }
      ]
    })
  })

  return {
    selectingUI: selecting.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const result = await streamUI({
    model: openai('gpt-3.5-turbo'),
    initial: <SpinnerMessage />,
    system: `\
    You are a appointment scheduling bot and you can help users schedule their appointments at a clinic, step by step.
    You and the user can discuss available appointment times and the user can view appointments and select one in the UI.
    
    Messages inside [] means that it's a UI element or a user event. For example:
    - "[Chose appointment 4]" means that the user has chosen the appointment with id number 4 in the UI.
    
    If the user requests to view open appoinements, call \`list_appointment_slots\` to show the open appointments UI.
    If the user wants to do something unrelated to discussing the clinic or its appointments, respond that you are a demo and cannot do that.
    
    Besides that, you can also chat with users.`,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    tools: {
      listAppointmentSlots: {
        description: 'List open appointment slots.',
        parameters: z.object({
          appointmentSlots: z.array(
            z.object({
              id: z.number().describe('A unique ID for this appointment'),
              time: z
                .string()
                .describe('The date and time of the event, in ISO-8601 format'),
              durationMinutes: z.number().describe('The time in minutes of the appointment'),
              doctor: z.string().describe('The doctor available for this slot')
            })
          )
        }),
        generate: async function* ({ appointmentSlots }) {
          yield (
            <BotCard>
              {/* <AppointmentsSkeleton /> */}
              Temp skeleton for now
            </BotCard>
          )

          await sleep(1000)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'listAppointmentSlots',
                content: `[Showing appointment slots with data: ${JSON.stringify(appointmentSlots)}]`
              }
            ]
          })

          return (
            <BotCard>
              <AppointmentSlots props={appointmentSlots} />
            </BotCard>
          )
        }
      },
    }
  })

  return {
    id: nanoid(),
    display: result.value
  }
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id: string
  name?: string
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmAppointment
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state, done }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`
      const title = messages[0].content.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'function' ? (
          message.name === 'listAppointmentSlots' ? (
            <BotCard>
              <AppointmentSlots props={JSON.parse(message.content)} />
            </BotCard>
          ) : null
        ) : message.role === 'user' ? (
          <UserMessage>{message.content}</UserMessage>
        ) : (
          <BotMessage content={message.content} />
        )
    }))
}
