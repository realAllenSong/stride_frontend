import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  CircleIcon,
  CheckCircleIcon,
  InfoIcon,
} from "@phosphor-icons/react";
export function Avatar({
  initials,
  color = "mint",
  small = false,
}: {
  initials: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`avatar ${color} ${small ? "small" : ""}`}
    >
      {initials}
    </span>
  );
}
export function TextLink({
  children,
  onClick,
  icon = true,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="text-link"
      onClick={onClick}
      aria-label={label}
    >
      {children}
      {icon && <ArrowRightIcon size={19} aria-hidden="true" />}
    </button>
  );
}
export function Card({
  children,
  className = "",
  title,
  icon,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <h2 className="card-label">
          {icon}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card empty-state">
      <span className="empty-symbol">
        <InfoIcon size={25} />
      </span>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </section>
  );
}
export function Criterion({
  label,
  state,
  detail,
}: {
  label: string;
  state: "met" | "not-met" | "unknown";
  detail?: string;
}) {
  return (
    <div className={`criterion ${state}`}>
      {state === "met" ? (
        <CheckCircleIcon size={22} />
      ) : (
        <CircleIcon size={22} />
      )}
      <div>
        <h3>{label}</h3>
        {detail && <p>{detail}</p>}
      </div>
      <span className="criterion-state">
        {state === "met"
          ? "Supported"
          : state === "not-met"
            ? "Not yet met"
            : "Not yet verified"}
      </span>
    </div>
  );
}
export function SkeletonContent() {
  return (
    <div className="pending-content" aria-busy="true" role="status">
      <span className="sr-only">Loading this snapshot</span>
      <div className="skeleton heading" />
      <div className="skeleton subtitle" />
      <div className="main-grid">
        <div>
          <div className="skeleton block" />
          <div className="skeleton block short" />
        </div>
        <div className="skeleton block short" />
      </div>
    </div>
  );
}
