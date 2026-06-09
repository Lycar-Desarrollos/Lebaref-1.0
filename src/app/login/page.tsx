
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is a simple redirect to the homepage which now serves as the login page.
export default function LoginPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null; 
}
