import React, { useState, useRef, useEffect } from 'react';
import { Customer } from '@billing/shared';
import { Search, Plus } from 'lucide-react';
import { apiRequest } from '../../api/client';

interface Props {
  customers: Customer[];
  selectedCustomerId: string;
  onSelect: (customerId: string) => void;
  onCustomerAdded: (newCustomer: Customer) => void;
}

export const CustomerAutocomplete: React.FC<Props> = ({ customers, selectedCustomerId, onSelect, onCustomerAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync initial value or when selectedCustomerId changes externally
  useEffect(() => {
    if (selectedCustomerId) {
      const cust = customers.find(c => c._id === selectedCustomerId);
      if (cust) setQuery(cust.name);
    } else {
      setQuery('');
    }
  }, [selectedCustomerId, customers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = query === '' 
    ? customers 
    : customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone?.includes(query));

  const exactMatch = customers.find(c => c.name.toLowerCase() === query.trim().toLowerCase());

  const handleSelect = (c: Customer | null) => {
    if (c) {
      setQuery(c.name);
      onSelect(c._id as string);
    } else {
      setQuery('');
      onSelect('');
    }
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    if (!query.trim()) return;
    setIsCreating(true);
    try {
      const res = await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({ name: query.trim(), email: `${query.trim().replace(/\s+/g, '').toLowerCase()}@walkin.local` })
      });
      if (res.success && res.data) {
        onCustomerAdded(res.data);
        handleSelect(res.data);
      } else {
        alert('Failed to create customer');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating customer');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search or type new customer name..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') onSelect('');
          }}
          onFocus={() => setIsOpen(true)}
          style={{ width: '100%', paddingLeft: '2rem' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      </div>

      {isOpen && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, 
          marginTop: '0.25rem', background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', 
          boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: '200px', overflowY: 'auto' 
        }}>
          <div 
            onClick={() => handleSelect(null)}
            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            -- Walk-in Customer (No Assignment) --
          </div>
          
          {filtered.map(c => (
            <div 
              key={c._id as string} 
              onClick={() => handleSelect(c)}
              style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              {c.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.phone}</div>}
            </div>
          ))}

          {!exactMatch && query.trim() !== '' && (
            <div 
              onClick={handleCreateNew}
              style={{ 
                padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: 'var(--accent-primary)', fontWeight: 600
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {isCreating ? 'Creating...' : <><Plus size={16} /> Add "{query}" as new customer</>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
