import { Search } from 'lucide-react'
import { AppTextInput } from './AppTextInput.jsx'

export function AppSearchBar({ placeholder = 'Search…', className = '', ...rest }) {
  return (
    <AppTextInput
      type="search"
      enterKeyHint="search"
      autoComplete="off"
      placeholder={placeholder}
      leftSlot={<Search className="h-4 w-4" aria-hidden />}
      className={`rounded-full px-4 ${className}`}
      {...rest}
    />
  )
}
