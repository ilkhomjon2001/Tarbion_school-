import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4h4v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </Icon>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </Icon>
  );
}

export function ClipboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M8 11h8M8 15h5" />
    </Icon>
  );
}

export function CheckSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="m8 12 2.5 2.5L16 9" />
    </Icon>
  );
}

export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m12 3 2.6 5.6 6.2.6-4.6 4.2 1.3 6.1L12 16.8 6.5 19.5l1.3-6.1L3.2 9.2l6.2-.6Z" />
    </Icon>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M14 16l4-4-4-4" />
      <path d="M18 12H9" />
    </Icon>
  );
}

export function BookOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 6.5c-1.6-1-4-1.5-6-1v12c2 0 4.4.5 6 1.5" />
      <path d="M12 6.5c1.6-1 4-1.5 6-1v12c-2 0-4.4.5-6 1.5" />
      <path d="M12 6.5v13.5" />
    </Icon>
  );
}

export function FlaskIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9.5 3h5" />
      <path d="M10.5 3.5v6l-5 9.5a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2l-5-9.5v-6" />
      <path d="M8 15h8" />
    </Icon>
  );
}

export function TrophyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5 3.5 3.5 0 0 0 6.5 10H7" />
      <path d="M17 5h2.5A1.5 1.5 0 0 1 21 6.5 3.5 3.5 0 0 1 17.5 10H17" />
      <path d="M12 14v3M9 20.5h6M9.5 20.5c0-2 .8-2.7 2.5-3.5 1.7.8 2.5 1.5 2.5 3.5" />
    </Icon>
  );
}

export function UtensilsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 3v7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V3M5 3v18M5 12v9" />
      <path d="M17 3c-1.7 0-3 2-3 5.5S15.3 13 17 13v8" />
    </Icon>
  );
}

export function SunriseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3v4M5 11a7 7 0 0 1 14 0" />
      <path d="M3 11h18M4.5 15h15M6 18h12" />
      <path d="m6 7 1.5 1.5M18 7l-1.5 1.5" />
    </Icon>
  );
}

export function CookieIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5c1 1.5 2.8 2 4.2 1.2-.3 1.7.9 3.4 2.6 3.6-1.2 1.1-1.3 3.1-.2 4.3-1.7.1-3 1.6-2.9 3.3-1.6-.6-3.4.2-4 1.8-1-1.4-2.9-1.8-4.4-.9.2-1.7-1-3.3-2.7-3.5 1.1-1.2 1-3.2-.2-4.3 1.7-.2 2.9-1.9 2.5-3.6 1.5.7 3.2 0 4.1-1.9Z" />
      <circle cx="10" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}
