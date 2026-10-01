import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

// Fechas en español en toda la app (nombres de días/meses en DatePicker y en format('ddd')).
dayjs.locale('es')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
