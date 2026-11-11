// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordInput, PasswordRules } from '@/components/auth/PasswordInput';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

describe('FormField', () => {
  it('connects the label, hint and error to the control for assistive technology', () => {
    render(
      <FormField
        label="Email address"
        hint="We never share it."
        error="Enter a valid email"
        required
      >
        {control => <Input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText(/Email address/);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    const described = input.getAttribute('aria-describedby') ?? '';
    expect(described.split(' ')).toHaveLength(2);
    expect(document.getElementById(described.split(' ')[0])?.textContent).toBe(
      'We never share it.',
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid email');
  });

  it('is not marked invalid and shows no alert without an error', () => {
    render(<FormField label="Phone">{control => <Input {...control} />}</FormField>);

    const input = screen.getByLabelText('Phone');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('gives every field a unique id', () => {
    render(
      <>
        <FormField label="First">{control => <Input {...control} />}</FormField>
        <FormField label="Second">{control => <Input {...control} />}</FormField>
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });
});

describe('Checkbox', () => {
  it('shows its error as an alert and links it to the input', () => {
    render(<Checkbox label="I hold a valid driving licence" error="Please confirm" />);

    const box = screen.getByLabelText('I hold a valid driving licence');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Please confirm');
    expect(box.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});

describe('PasswordInput and PasswordRules', () => {
  it('hides the password by default and toggles visibility with an accessible button', () => {
    render(<PasswordInput aria-label="Password" />);

    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('updates the rule checklist as the password changes', () => {
    const { rerender } = render(<PasswordRules value="" />);
    expect(screen.getAllByText(/not met yet/)).toHaveLength(3);

    rerender(<PasswordRules value="abcdefg1" />);
    expect(screen.queryAllByText(/not met yet/)).toHaveLength(0);
    expect(screen.getAllByText(/\(met\)/)).toHaveLength(3);

    rerender(<PasswordRules value="abcdefgh" />);
    expect(screen.getAllByText(/not met yet/)).toHaveLength(1);
    expect(screen.getByText(/One number/).textContent).toContain('not met yet');
  });

  it('passes typed values through to the form library', () => {
    const onChange = vi.fn();
    render(<PasswordInput aria-label="Password" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Prestige2026' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
