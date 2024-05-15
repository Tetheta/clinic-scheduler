'use client'

import { useActions, useUIState } from 'ai/rsc'

import type { AI } from '@/lib/chat/actions'

interface AppointmentSlot {
    id: number
    time: string
    durationMinutes: number
    doctor: string
}

export function AppointmentSlots({ props: appointmentSlots }: { props: AppointmentSlot[] }) {
    const [, setMessages] = useUIState<typeof AI>()
    const { submitUserMessage } = useActions()

    return (
        <div>
            <div className="mb-4 flex flex-col gap-2 overflow-y-scroll pb-4 text-sm sm:flex-row">
                {appointmentSlots.map(appointmentSlot => (
                    <button
                        key={appointmentSlot.id}
                        className="flex cursor-pointer flex-row gap-2 rounded-lg bg-zinc-800 p-2 text-left hover:bg-zinc-700 sm:w-52"
                        onClick={async () => {
                            const response = await submitUserMessage(`View ${appointmentSlot.id}`)
                            setMessages(currentMessages => [...currentMessages, response])
                        }}
                    >
                        <div
                            className="flex w-11 flex-row justify-center rounded-md bg-white/10 p-2"
                        >
                            {Date.parse(appointmentSlot.time)}
                        </div>
                        <div className="flex flex-col">
                            <div className="text-base text-zinc-500">
                                Duration: {appointmentSlot.durationMinutes}
                            </div>
                        </div>
                        <div className="ml-auto flex flex-col">
                            <div
                                className="text-right text-base"
                            >
                                Doctor: {appointmentSlot.doctor}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}
