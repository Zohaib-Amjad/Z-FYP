'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { applyServerErrors, type CodeFieldMap } from '@/lib/forms';

interface UseApiFormOptions<TSchema extends z.ZodType<FieldValues, z.ZodTypeDef, FieldValues>> {
  schema: TSchema;
  defaultValues: DefaultValues<z.infer<TSchema>>;
  /** Performs the API call. Throw (an ApiError) to surface server-side problems. */
  onSubmit: (values: z.infer<TSchema>) => Promise<void>;
  /** Error codes that belong to one field (e.g. EMAIL_TAKEN -> email). */
  codeFields?: CodeFieldMap;
  /** Runs first on any failure; return true when the error was handled and needs no banner. */
  onError?: (error: unknown) => boolean;
}

interface UseApiFormResult<TValues extends FieldValues> {
  form: UseFormReturn<TValues>;
  /** Pass to <form onSubmit>. */
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  /** A server error that does not belong to any field; render it as an alert above the form. */
  formError: string | null;
}

/**
 * The form convention for the whole app: react-hook-form + zod resolver for client validation,
 * and 422 field errors from the API mapped back onto the matching inputs.
 */
export function useApiForm<TSchema extends z.ZodType<FieldValues, z.ZodTypeDef, FieldValues>>({
  schema,
  defaultValues,
  onSubmit,
  codeFields,
  onError,
}: UseApiFormOptions<TSchema>): UseApiFormResult<z.infer<TSchema>> {
  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const fieldNames = Object.keys(defaultValues);

  const submit = form.handleSubmit(async values => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (onError?.(error)) return;
      setFormError(applyServerErrors(error, form.setError, fieldNames, codeFields));
    }
  });

  return { form, submit, formError };
}
