"use client";

import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { enterApp } from "../roleHome";

// The landing page is for signed-out visitors. It renders immediately (so it
// can be server-rendered and indexed); anyone already signed in is moved on to
// their role's home once the session has been checked.
export function RedirectIfSignedIn() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) enterApp(user.role);
  }, [user]);

  return null;
}
