import { AppButton } from '../app-ui/buttons/AppButton.jsx'

/**
 * Primary CTA — same gradient language as landing `ButtonLink` primary.
 * Use `as={Link}` with `to` for navigation, or default `button`.
 */
export function AppPrimaryButton({ as: Comp = 'button', className = '', children, loading, ...rest }) {
  return (
    <AppButton as={Comp} variant="primary" size="md" className={className} loading={loading} {...rest}>
      {children}
    </AppButton>
  )
}
