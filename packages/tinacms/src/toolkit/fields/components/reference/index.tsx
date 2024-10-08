import * as React from 'react'
import { useCMS } from '@toolkit/react-tinacms/use-cms'
import ReferenceSelect from './reference-select'
import ReferenceLink from './reference-link'

type Option = {
  value: string
  label: string
}

type ReferenceFieldOptions = {
  optionComponent?: OptionComponent
  experimental___filter?: (list: Array<any>, searchQuery: string) => Array<any>
}

type OptionComponent = (
  props: unknown,
  _sys: InternalSys
) => React.ReactElement | string

export interface InternalSys {
  filename: string
  path: string
}

export interface ReferenceFieldProps extends ReferenceFieldOptions {
  label?: string
  name: string
  component: string
  collections: string[]
  options: (Option | string)[]
}

export interface ReferenceProps {
  name: string
  input: any
  field: ReferenceFieldProps
  disabled?: boolean
  options?: (Option | string)[]
}

export const Reference: React.FC<ReferenceProps> = ({ input, field }) => {
  const cms = useCMS()

  return (
    <div>
      <div className="relative group">
        <ReferenceSelect cms={cms} input={input} field={field} />
      </div>
      <ReferenceLink cms={cms} input={input} />
    </div>
  )
}
