import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LegacySettingsRedirect } from './LegacySettingsRedirect';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

describe('LegacySettingsRedirect', () => {
  it('preserves query strings and hash fragments', async () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=billing&return=checkout#billing']}>
        <Routes>
          <Route path="/settings" element={<LegacySettingsRedirect />} />
          <Route path="/account" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/account?tab=billing&return=checkout#billing');
  });
});
