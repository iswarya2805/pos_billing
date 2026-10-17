import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './style/Navbar.css'
import './style/Sidebar.css'
import './style/StaffDashboard.css'
import './style/MyBills.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
