// This route moved to the home page ("/") — customers no longer need /customer.
// Kept as a redirect so any old links or bookmarks still work.
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function CustomerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
