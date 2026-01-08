import { ThemeProvider, StickiesProvider } from '@/context'
import { CanvasLayout } from '@/components/templates'

function App() {
  return (
    <ThemeProvider>
      <StickiesProvider>
        <CanvasLayout />
      </StickiesProvider>
    </ThemeProvider>
  )
}

export default App
