import { AppButton } from '../app-ui/buttons/AppButton.jsx'

export function AppSecondaryButton({ as: Comp = 'button', className = '', children, loading, ...rest }) {
  return (
    <AppButton as={Comp} variant="secondary" size="md" className={className} loading={loading} {...rest}>
      {children}
    </AppButton>
  )
}
