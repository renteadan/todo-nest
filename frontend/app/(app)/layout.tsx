import { Navbar } from '../navbar';

/**
 * The logged-in pages share one navbar. Rendered per page instead, Next keeps
 * the previous page hidden in the DOM after a link click, and its navbar's
 * profile menu would share an id with the current one.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
