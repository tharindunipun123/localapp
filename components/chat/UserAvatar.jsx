"use client";

import { cn } from "@/lib/utils/cn";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function UserAvatar({ user, name, photoURL, size = "md", className }) {
  const displayName = user?.displayName ?? name ?? "User";
  const photo = user?.photoURL ?? photoURL;
  const initial = displayName.charAt(0).toUpperCase();

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={displayName}
        className={cn(sizes[size], "shrink-0 rounded-full object-cover ring-2 ring-white", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizes[size],
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] font-semibold text-[var(--color-primary-fg)] ring-2 ring-white",
        className
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function AvatarStack({ users, max = 5, size = "sm" }) {
  const visible = users.slice(0, max);
  const extra = users.length - max;

  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <UserAvatar
          key={user.uid ?? user.id ?? i}
          user={user}
          size={size}
          className={i > 0 ? "-ml-2" : ""}
        />
      ))}
      {extra > 0 && (
        <span className="ml-1.5 text-xs font-medium text-[var(--color-muted)]">+{extra}</span>
      )}
    </div>
  );
}
