'use client'

import dynamic from 'next/dynamic'

export { spinner } from './spinner'
export { BotCard, BotMessage, SystemMessage } from './message'


const AppointmentSlots = dynamic(() => import('./appointment-slots').then(mod => mod.AppointmentSlots), {
  ssr: false,
  loading: () => <div>Temp Skeleton</div>
})

export { AppointmentSlots }
