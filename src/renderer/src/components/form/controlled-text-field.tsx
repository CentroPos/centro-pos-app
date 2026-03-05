import { CustomInput, type InputProps } from '../ui/custom-input'
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from '../ui/form'
import { Control } from 'react-hook-form'

type ControlledTextFieldProps = {
  name: string
  control: Control<any, any>
  label?: string
  description?: string
  hideErrorMessage?: boolean
} & InputProps

const ControlledTextField = (props: ControlledTextFieldProps) => {
  const { name, control, label, description, required, hideErrorMessage, ...rest } = props
  return (
    <FormField
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const body = error ? String(error?.message) : undefined

        return (
          <FormItem>
            {Boolean(label) && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
              </FormLabel>
            )}
            <FormControl>
              <CustomInput
                {...rest}
                label={undefined}
                {...field}
                error={Boolean(error)}
                errorMessage={hideErrorMessage ? undefined : body}
              />
            </FormControl>
            {Boolean(description) && <FormDescription>{description}</FormDescription>}
          </FormItem>
        )
      }}
    />
  )
}

export { ControlledTextField }
