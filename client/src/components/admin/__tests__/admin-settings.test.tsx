import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminSettings } from '../admin-settings';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('AdminSettings', () => {
  it('should render platform settings section', () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    expect(screen.getByText('Platform Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Platform Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Default Currency')).toBeInTheDocument();
  });

  it('should render forum settings section', () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    expect(screen.getByText('Forum Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Allow Guest Posting')).toBeInTheDocument();
    expect(screen.getByLabelText('Auto-moderate New Posts')).toBeInTheDocument();
  });

  it('should display default platform settings', () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const platformNameInput = screen.getByLabelText('Platform Name') as HTMLInputElement;
    expect(platformNameInput.value).toBe('PriceCompare Community');
  });

  it('should update platform name input', () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const platformNameInput = screen.getByLabelText('Platform Name') as HTMLInputElement;
    fireEvent.change(platformNameInput, { target: { value: 'New Platform Name' } });

    expect(platformNameInput.value).toBe('New Platform Name');
  });

  it('should show unsaved changes badge when platform settings change', async () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const platformNameInput = screen.getByLabelText('Platform Name') as HTMLInputElement;
    fireEvent.change(platformNameInput, { target: { value: 'Changed Name' } });

    await waitFor(() => {
      expect(screen.getAllByText('Unsaved changes')[0]).toBeInTheDocument();
    });
  });

  it('should enable save button when changes are made', async () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const platformNameInput = screen.getByLabelText('Platform Name') as HTMLInputElement;
    fireEvent.change(platformNameInput, { target: { value: 'Changed Name' } });

    await waitFor(() => {
      const saveButtons = screen.getAllByText('Save Changes');
      expect(saveButtons[0]).not.toBeDisabled();
    });
  });

  it('should enable reset button when changes are made', async () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const platformNameInput = screen.getByLabelText('Platform Name') as HTMLInputElement;
    fireEvent.change(platformNameInput, { target: { value: 'Changed Name' } });

    await waitFor(() => {
      const resetButtons = screen.getAllByText('Reset');
      expect(resetButtons[0]).not.toBeDisabled();
    });
  });

  it('should reset platform settings when reset button is clicked', async () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const platformNameInput = screen.getByLabelText('Platform Name') as HTMLInputElement;
    fireEvent.change(platformNameInput, { target: { value: 'Changed Name' } });

    const resetButtons = screen.getAllByText('Reset');
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(platformNameInput.value).toBe('PriceCompare Community');
    });
  });

  it('should render currency options', () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const currencySelect = screen.getByLabelText('Default Currency');
    expect(currencySelect).toBeInTheDocument();
  });

  it('should have save and reset buttons for both sections', () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    const saveButtons = screen.getAllByText('Save Changes');
    const resetButtons = screen.getAllByText('Reset');

    expect(saveButtons).toHaveLength(2); // Platform and Forum
    expect(resetButtons).toHaveLength(2); // Platform and Forum
  });

  it('should display settings descriptions', () => {
    render(<AdminSettings />, { wrapper: createWrapper() });

    expect(screen.getByText('Configure main platform settings')).toBeInTheDocument();
    expect(screen.getByText('Configure forum-specific settings')).toBeInTheDocument();
  });
});
