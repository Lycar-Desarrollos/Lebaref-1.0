import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  href = "/",
  width = 120,
  height = 30
}: {
  className?: string;
  href?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2', className)}
      aria-label="LEBAREF Home"
    >
      <Image
        src="/logo.png"
        alt="LEBAREF Logo"
        width={width}
        height={height}
        className="object-contain"
        priority
      />
    </Link>
  );
}
