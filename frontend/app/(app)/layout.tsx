import { Navbar } from '../navbar';
import { ActionErrors } from './tasks/action-error';

/**
 * The logged-in pages share one navbar. Rendered per page instead, Next keeps
 * the previous page hidden in the DOM after a link click, and its navbar's
 * profile menu would share an id with the current one. Action errors show
 * here too, as the navbar's invite buttons can fail on any page.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <Navbar />
      {children}
      <ActionErrors />
    </>
  );
}
