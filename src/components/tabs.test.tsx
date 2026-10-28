import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tabs, tabPanelProps } from './tabs';

function Harness() {
  const [value, setValue] = useState<'firearms' | 'ammunition'>('firearms');
  return (
    <>
      <Tabs
        id="inv"
        aria-label="Categorías"
        value={value}
        onChange={setValue}
        tabs={[
          { value: 'firearms', label: 'Armas', count: 3 },
          { value: 'ammunition', label: 'Municiones' },
        ]}
      />
      <div {...tabPanelProps('inv', value)}>Panel {value}</div>
    </>
  );
}

describe('Tabs', () => {
  it('marca la pestaña elegida y la vincula con su panel', async () => {
    render(<Harness />);
    const firearms = screen.getByRole('tab', { name: /Armas/ });
    expect(firearms).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: /Armas/ })).toHaveTextContent('Panel firearms');

    await userEvent.click(screen.getByRole('tab', { name: 'Municiones' }));
    expect(screen.getByRole('tab', { name: 'Municiones' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Municiones' })).toHaveTextContent(
      'Panel ammunition',
    );
  });

  it('se navega con las flechas', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Municiones' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Municiones' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
