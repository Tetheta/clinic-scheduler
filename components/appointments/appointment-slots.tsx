'use client'

import { useActions, useUIState } from 'ai/rsc'

import type { AI } from '@/lib/chat/actions'
import { useState } from 'react'

interface AppointmentSlot {
    id: number
    time: string
    durationMinutes: number
    doctor: string
}

export function AppointmentSlots({ props: appointmentSlots }: { props: AppointmentSlot[] }) {
    const [, setMessages] = useUIState<typeof AI>()
    const [selectingUI, setSelectingUI] = useState<null | React.ReactNode>(null)
    const { confirmAppointment } = useActions()

    return (
        <div>
            {selectingUI ? (<div className="mt-4 text-zinc-200">{selectingUI}</div>) :
                (<div className="flex flex-row gap-2 overflow-y-scroll text-sm sm:flex-col">
                    {appointmentSlots.map(appointmentSlot => (
                        <button
                            key={appointmentSlot.id}
                            className="flex cursor-pointer flex-row gap-2 rounded-lg bg-zinc-800 text-left hover:bg-zinc-700 sm:w-85"
                            onClick={async () => {
                                const response = await confirmAppointment(appointmentSlot)
                                setSelectingUI(response.selectingUI)

                                // Insert a new system message to the UI.
                                setMessages((currentMessages: any) => [
                                    ...currentMessages,
                                    response.newMessage
                                ])
                            }}
                        >
                            <div
                                className="flex flex-row justify-center rounded-md"
                            >
                                {new Date(appointmentSlot.time).toLocaleString()}
                            </div>
                            <div className="flex flex-col">
                                Duration: {appointmentSlot.durationMinutes} minutes
                            </div>
                            <div className="ml-auto flex flex-col">
                                Doctor: {appointmentSlot.doctor}
                            </div>
                        </button>
                    ))}
                </div>)}
        </div>
    )
}
