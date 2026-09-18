"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { DayPicker } from "react-day-picker";
import {
  CubeTransparentIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CalendarBlankIcon,
  MagnifyingGlassIcon,
  SquaresFourIcon,
  UserCircleIcon,
  InfoIcon,
  MoonIcon,
  SunIcon,
  ListIcon,
  XIcon,
  CheckIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { Dashboard, Query } from "@/lib/contracts";
import { periodLabel, PERIODS, shiftPeriod, type Period } from "@/lib/dates";
import { Avatar, SkeletonContent } from "./ui";
import { Details, type Detail } from "./dialogs";
import {
  PeopleDirectory,
  PersonView,
  Portfolio,
  Progress,
  ProjectView,
} from "./views";

export function DashboardApp({
  data,
  initialTheme = "light",
}: {
  data: Dashboard;
  initialTheme?: "light" | "dark";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeSearch, setScopeSearch] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const [detail, setDetail] = useState<Detail | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const { query, selectedPerson, selectedProject } = data;
  useEffect(() => {
    const closeTransientUI = () => {
      setDetail(null);
      setCalendarOpen(false);
      setScopeOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("popstate", closeTransientUI);
    return () => window.removeEventListener("popstate", closeTransientUI);
  }, []);
  function navigate(patch: Partial<Query>) {
    setDetail(null);
    setCalendarOpen(false);
    setScopeOpen(false);
    setMenuOpen(false);
    if (patch.scope || patch.view) setSearch("");
    const next = { ...query, ...patch };
    startTransition(() =>
      router.push(`/?${new URLSearchParams(next)}`, { scroll: false }),
    );
  }
  const groupName =
    data.workspace.groups.find((g) => g.id === query.scope)?.name ??
    "All groups";
  const viewIsPeople = query.view !== "projects";
  const sidebarProjects = data.workspace.projects.filter(
    (p) =>
      (query.scope === "all" || p.groupId === query.scope) &&
      `${p.name} ${p.purpose}`.toLowerCase().includes(search.toLowerCase()),
  );
  const sidebarPeople = data.workspace.people.filter(
    (p) =>
      (query.scope === "all" || p.groupId === query.scope) &&
      `${p.name} ${p.role}`.toLowerCase().includes(search.toLowerCase()),
  );
  const title =
    query.view === "self"
      ? "My view"
      : (selectedProject?.name ??
        selectedPerson?.name ??
        (query.scope === "all"
          ? `Engineering / ${viewIsPeople ? "People" : "All groups"}`
          : groupName));
  const subtitle = selectedProject
    ? `${data.workspace.groups.find((g) => g.id === selectedProject.groupId)?.name} · ${selectedProject.ownerIds.map((id) => data.workspace.people.find((p) => p.id === id)?.name).join(", ")}`
    : selectedPerson
      ? `${selectedPerson.role} · ${data.workspace.groups.find((g) => g.id === selectedPerson.groupId)?.name}`
      : undefined;
  const tabs =
    query.view === "self"
      ? [
          { label: "Shared view", id: "overview" },
          { label: "Suggestions", id: "suggestions" },
        ]
      : viewIsPeople
        ? [
            { label: "Brief", id: "overview" },
            { label: "Contributions", id: "contributions" },
            { label: "Progress", id: "progress" },
          ]
        : [
            { label: "Overview", id: "overview" },
            { label: "Progress", id: "progress" },
          ];
  const props = { data, open: setDetail, navigate };
  const selectedDate = new Date(
    Number(query.date.slice(0, 4)),
    Number(query.date.slice(5, 7)) - 1,
    Number(query.date.slice(8, 10)),
    12,
  );
  const sideContent = (
    <>
      <button
        className="brand"
        aria-label="STRIDE home"
        onClick={() =>
          navigate({
            view: "projects",
            id: "all",
            scope: "all",
            tab: "overview",
          })
        }
      >
        <CubeTransparentIcon weight="fill" size={32} />
        <span>STRIDE</span>
      </button>
      <Popover.Root open={scopeOpen} onOpenChange={setScopeOpen}>
        <Popover.Trigger className="scope-trigger" aria-label="Choose group">
          <span>{groupName}</span>
          <CaretDownIcon size={17} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="popover scope-popover"
            sideOffset={8}
            align="start"
          >
            <p className="popover-label">Your groups</p>
            <label className="search-field">
              <MagnifyingGlassIcon size={18} />
              <input
                aria-label="Find a group"
                value={scopeSearch}
                onChange={(e) => setScopeSearch(e.target.value)}
                placeholder="Find a group"
              />
            </label>
            {[{ id: "all", name: "All groups" }, ...data.workspace.groups]
              .filter((g) =>
                g.name.toLowerCase().includes(scopeSearch.toLowerCase()),
              )
              .map((group) => (
                <button
                  key={group.id}
                  className={`menu-item ${query.scope === group.id ? "active" : ""}`}
                  onClick={() => {
                    setScopeSearch("");
                    navigate({
                      scope: group.id,
                      id: "all",
                      view: query.view === "self" ? "people" : query.view,
                    });
                  }}
                >
                  {group.name}
                  {query.scope === group.id && <CheckIcon size={16} />}
                </button>
              ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div className="segmented view-toggle" aria-label="Browse by">
        <button
          aria-pressed={!viewIsPeople}
          onClick={() =>
            navigate({ view: "projects", id: "all", tab: "overview" })
          }
        >
          Projects
        </button>
        <button
          aria-pressed={viewIsPeople}
          onClick={() =>
            navigate({ view: "people", id: "all", tab: "overview" })
          }
        >
          People
        </button>
      </div>
      <label className="search-field sidebar-search">
        <MagnifyingGlassIcon size={19} />
        <input
          aria-label={viewIsPeople ? "Find a teammate" : "Find a project"}
          placeholder={viewIsPeople ? "Find a teammate" : "Find a project"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <nav
        className="entity-nav"
        aria-label={viewIsPeople ? "People" : "Projects"}
      >
        <button
          className={`nav-overview ${query.id === "all" ? "selected" : ""}`}
          onClick={() =>
            navigate({
              id: "all",
              view: viewIsPeople ? "people" : "projects",
              tab: "overview",
            })
          }
        >
          {viewIsPeople ? (
            <UsersThreeIcon size={20} />
          ) : (
            <SquaresFourIcon size={20} />
          )}
          <span>{viewIsPeople ? "All people" : "All projects"}</span>
        </button>
        {viewIsPeople ? (
          <>
            <h2 className="nav-label">Team members</h2>
            {sidebarPeople.map((person) => (
              <button
                className={`entity-item ${person.id === query.id ? "selected" : ""}`}
                key={person.id}
                onClick={() =>
                  navigate({ view: "people", id: person.id, tab: "overview" })
                }
              >
                <Avatar initials={person.initials} color={person.color} small />
                <span>
                  {person.name}
                  {data.workspace.people.some(
                    (p) => p.reportsTo === person.id,
                  ) && <small>{person.role}</small>}
                </span>
              </button>
            ))}
          </>
        ) : (
          data.workspace.groups
            .filter((g) => sidebarProjects.some((p) => p.groupId === g.id))
            .map((group) => (
              <div className="nav-group" key={group.id}>
                <h2 className="nav-label">
                  {query.scope === "all" ? group.name : "Projects"}
                </h2>
                {sidebarProjects
                  .filter((p) => p.groupId === group.id)
                  .map((project) => (
                    <button
                      className={`entity-item ${project.id === query.id ? "selected" : ""}`}
                      key={project.id}
                      onClick={() =>
                        navigate({ id: project.id, tab: "overview" })
                      }
                    >
                      <Avatar
                        initials={project.initials}
                        color={project.color}
                        small
                      />
                      <span>{project.name}</span>
                    </button>
                  ))}
              </div>
            ))
        )}
        {(viewIsPeople ? sidebarPeople : sidebarProjects).length === 0 && (
          <p className="sidebar-empty">No matches. Try another name.</p>
        )}
      </nav>
      <div className="sidebar-bottom">
        <button
          className={`bottom-link ${query.view === "self" ? "selected" : ""}`}
          onClick={() =>
            navigate({
              view: "self",
              id: data.session?.personId ?? "zhiyuan",
              scope: "all",
              tab: "suggestions",
            })
          }
        >
          <UserCircleIcon size={21} />
          My view
        </button>
        <div className="sidebar-foot">
          <button
            className="bottom-link muted"
            onClick={() => setDetail({ kind: "about" })}
          >
            <InfoIcon size={19} />
            {data.session?.synthetic !== false
              ? "Illustrative data"
              : "Shared workspace"}
          </button>
          <button
            className="icon-button theme-toggle"
            aria-label={
              theme === "light" ? "Use dark theme" : "Use light theme"
            }
            onClick={() => {
              const next = theme === "light" ? "dark" : "light";
              setTheme(next);
              document.body.dataset.theme = next;
              document.cookie = `stride-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
            }}
          >
            {theme === "light" ? <MoonIcon size={18} /> : <SunIcon size={18} />}
          </button>
        </div>
      </div>
    </>
  );
  return (
    <div
      className="app-shell"
      data-theme={theme}
      onClickCapture={(event) => {
        // Safari does not focus buttons on pointer clicks. Retain the actual opening control.
        if (!detail && event.target instanceof Element)
          detailTrigger.current =
            event.target.closest<HTMLElement>("button, a");
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{sideContent}</aside>
      <div className="mobile-bar">
        <span className="brand">
          <CubeTransparentIcon weight="fill" size={26} />
          STRIDE
        </span>
        <button
          className="icon-button"
          aria-label="Open navigation"
          onClick={() => setMenuOpen(true)}
        >
          <ListIcon size={23} />
        </button>
      </div>
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="mobile-sidebar">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">
              Select a group, project or person.
            </Dialog.Description>
            <Dialog.Close
              className="mobile-close icon-button"
              aria-label="Close navigation"
            >
              <XIcon size={22} />
            </Dialog.Close>
            {sideContent}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <main id="main-content" className="workspace">
        <header className="workspace-header">
          <div className="identity">
            {(selectedProject || selectedPerson) && (
              <Avatar
                initials={selectedProject?.initials ?? selectedPerson!.initials}
                color={selectedProject?.color ?? selectedPerson!.color}
              />
            )}
            <div>
              <div className="workspace-title">{title}</div>
              {subtitle && <p className="workspace-subtitle">{subtitle}</p>}
            </div>
          </div>
          <div className="period-controls">
            <div className="date-control">
              <button
                className="icon-button"
                aria-label="Previous period"
                disabled={query.date === "2000-01-01"}
                onClick={() =>
                  navigate({ date: shiftPeriod(query.date, query.period, -1) })
                }
              >
                <CaretLeftIcon size={20} />
              </button>
              <Popover.Root open={calendarOpen} onOpenChange={setCalendarOpen}>
                <Popover.Trigger
                  className="date-trigger"
                  aria-label="Choose historical date"
                >
                  <CalendarBlankIcon size={21} />
                  <span>{periodLabel(query.date, query.period)}</span>
                  <CaretDownIcon size={15} />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="popover calendar-popover"
                    sideOffset={12}
                    align="end"
                  >
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      defaultMonth={selectedDate}
                      weekStartsOn={1}
                      captionLayout="dropdown"
                      startMonth={new Date(2000, 0)}
                      endMonth={new Date(2100, 11)}
                      disabled={{
                        before: new Date(2000, 0, 1),
                        after: new Date(2100, 11, 31),
                      }}
                      onSelect={(date) => {
                        if (date)
                          navigate({
                            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
                          });
                      }}
                    />
                    <div className="calendar-footer">
                      <button
                        className="text-link"
                        onClick={() => navigate({ date: data.workspace.asOf })}
                      >
                        {data.session?.synthetic !== false
                          ? "Latest demo snapshot"
                          : "Latest snapshot"}
                      </button>
                      <span>America/New_York</span>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              <button
                className="icon-button"
                aria-label="Next period"
                disabled={query.date === "2100-12-31"}
                onClick={() =>
                  navigate({ date: shiftPeriod(query.date, query.period, 1) })
                }
              >
                <CaretRightIcon size={20} />
              </button>
            </div>
            <div className="segmented period-toggle" aria-label="Time period">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  aria-pressed={query.period === period}
                  onClick={() => navigate({ period: period as Period })}
                >
                  {period[0].toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </header>
        <nav className="page-tabs" aria-label="View sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              aria-current={query.tab === tab.id ? "page" : undefined}
              onClick={() => navigate({ tab: tab.id as Query["tab"] })}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="page-content" aria-busy={pending}>
          {pending ? (
            <SkeletonContent />
          ) : query.view === "projects" ? (
            selectedProject ? (
              <ProjectView {...props} />
            ) : query.tab === "progress" ? (
              <Progress {...props} />
            ) : (
              <Portfolio {...props} />
            )
          ) : selectedPerson ? (
            <PersonView {...props} />
          ) : query.tab === "progress" ? (
            <Progress {...props} />
          ) : (
            <PeopleDirectory {...props} />
          )}
        </div>
      </main>
      <div data-theme={theme}>
        <Details
          detail={detail}
          setDetail={setDetail}
          data={data}
          navigate={navigate}
          returnFocus={detailTrigger}
        />
      </div>
    </div>
  );
}
