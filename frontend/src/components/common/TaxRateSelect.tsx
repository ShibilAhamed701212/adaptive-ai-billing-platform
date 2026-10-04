import React from 'react';
import { useTaxSystem, formatTaxRate } from '../../utils/tax';

interface TaxRateSelectProps {
  value: number;
  onChange: (rate: number) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/** Tax-rate dropdown for the organization's tax system. Always lists the current value so it never displays a different rate. */
export const TaxRateSelect: React.FC<TaxRateSelectProps> = ({ value, onChange, className, style, disabled }) => {
  const { rates, label } = useTaxSystem();
  const current = Number(value) || 0;
  const options = rates.includes(current) ? rates : [...rates, current].sort((a, b) => a - b);
  return (
    <select className={className} style={style} disabled={disabled} value={current} onChange={(e) => onChange(parseFloat(e.target.value))}>
      {options.map((r) => (
        <option key={r} value={r}>
          {r === 0 ? '0% (Exempt)' : `${formatTaxRate(r)} ${label}`}
        </option>
      ))}
    </select>
  );
};
