import { useEffect, useState, type ElementType } from "react";
import { Link as RouterLink, useLocation, useOutlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { alpha, Badge, BottomNavigation, BottomNavigationAction, Box, Drawer, IconButton, lighten, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import AcUnitRoundedIcon from "@mui/icons-material/AcUnitRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import SpaceDashboardRoundedIcon from "@mui/icons-material/SpaceDashboardRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import QuizRoundedIcon from "@mui/icons-material/QuizRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import PropaneTankRoundedIcon from "@mui/icons-material/PropaneTankRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import GppGoodRoundedIcon from "@mui/icons-material/GppGoodRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import { useAuth } from "../auth/AuthContext";
import { fetchContractorPendingApprovals, fetchContractors } from "../api/endpoints";
import { ROLE_ACCENTS } from "../theme";
import { FONT, L, gridBackground, mono } from "../screens/landing/tokens";
import { AlertsBell } from "./AlertsBell";
import { Logo } from "./Logo";
import { EASE } from "./motion";
import { OfflineBanner } from "./OfflineBanner";
import { CommandPalette, SearchButton } from "./CommandPalette";
import { useColorMode } from "../ui/ColorMode";
import type { Role } from "../types";

type NavLinkDef = { label: string; to: string; icon: ElementType };

const NAV_LINKS: Record<Role, NavLinkDef[]> = {
  facility_manager: [
    { label: "Facilities", to: "/facilities", icon: ApartmentRoundedIcon },
    { label: "Equipment", to: "/equipment", icon: AcUnitRoundedIcon },
    { label: "Jobs", to: "/jobs", icon: WorkRoundedIcon },
    { label: "Calendar", to: "/calendar", icon: CalendarMonthRoundedIcon },
    { label: "Dashboard", to: "/dashboard", icon: SpaceDashboardRoundedIcon },
  ],
  technician: [
    { label: "My Profile", to: "/profile", icon: BadgeRoundedIcon },
    { label: "Credentials", to: "/credentials", icon: VerifiedUserRoundedIcon },
    { label: "Capabilities", to: "/capabilities", icon: ConstructionRoundedIcon },
    { label: "Assessments", to: "/assessments", icon: QuizRoundedIcon },
    { label: "My Jobs", to: "/my-jobs", icon: AssignmentRoundedIcon },
    { label: "Calendar", to: "/calendar", icon: CalendarMonthRoundedIcon },
  ],
  contractor_manager: [
    { label: "Company", to: "/company", icon: BusinessRoundedIcon },
    { label: "Roster", to: "/roster", icon: GroupsRoundedIcon },
    { label: "Team Capabilities", to: "/team-capabilities", icon: HubRoundedIcon },
    { label: "Cylinders", to: "/cylinders", icon: PropaneTankRoundedIcon },
    { label: "Calendar", to: "/calendar", icon: CalendarMonthRoundedIcon },
  ],
  admin: [
    { label: "Dashboard", to: "/admin", icon: SpaceDashboardRoundedIcon },
    { label: "Credentials", to: "/admin/credentials", icon: VerifiedUserRoundedIcon },
    { label: "Capabilities", to: "/admin/capabilities", icon: ConstructionRoundedIcon },
    { label: "Contractor Docs", to: "/admin/contractor-documents", icon: DescriptionRoundedIcon },
    { label: "Contractor Verification", to: "/admin/contractor-verifications", icon: GppGoodRoundedIcon },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  facility_manager: "Facility Manager",
  technician: "Technician",
  contractor_manager: "Contractor Manager",
  admin: "Administrator",
};

const SIDEBAR_WIDTH = 272;

function isActive(pathname: string, to: string) {
  if (to === "/admin") return pathname === "/admin";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const outlet = useOutlet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { mode, toggle } = useColorMode();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const accent = user ? ROLE_ACCENTS[user.role] : ROLE_ACCENTS.technician;
  const links = user ? NAV_LINKS[user.role] : [];
  const current = links.find((l) => isActive(location.pathname, l.to));

  const { data: companies } = useQuery({
    queryKey: ["contractors"],
    queryFn: fetchContractors,
    enabled: user?.role === "contractor_manager",
  });
  const company = companies?.[0];
  const { data: pendingApprovals } = useQuery({
    queryKey: ["contractor-pending-approvals", company?.id],
    queryFn: () => fetchContractorPendingApprovals(company!.id),
    enabled: !!company,
  });

  const initials = user ? (`${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}` || user.email[0]).toUpperCase() : "";

  const sidebar = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        bgcolor: L.ink,
        borderRight: `2px solid ${L.ink}`,
        ...gridBackground("rgba(239,233,220,0.04)", "rgba(239,233,220,0.075)"),
      }}
    >
      <Box sx={{ position: "relative", px: 3, pt: 3.25, pb: 3 }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <Logo light size={34} />
        </a>
      </Box>

      <Typography sx={{ position: "relative", px: 3, mb: 1.25, ...mono, fontSize: 11, color: L.heat }}>
        Workspace
      </Typography>

      <LayoutGroup id="sidebar">
        <Stack component="nav" spacing={0.5} sx={{ position: "relative", px: 1.5, flexGrow: 1, overflowY: "auto" }}>
          {links.map((link) => {
            const active = isActive(location.pathname, link.to);
            const Icon = link.icon;
            const showBadge = link.to === "/team-capabilities" && !!pendingApprovals;
            return (
              <Box
                key={link.to}
                component={RouterLink}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                sx={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 1.75,
                  py: 1.25,
                  borderRadius: "3px",
                  textDecoration: "none",
                  fontSize: 14.5,
                  fontWeight: active ? 800 : 600,
                  color: active ? accent.text : "rgba(239,233,220,0.72)",
                  transition: "color 0.2s ease, background-color 0.2s ease, transform 0.2s ease",
                  "&:hover": { color: active ? accent.text : L.paper, bgcolor: active ? "transparent" : "rgba(239,233,220,0.09)", transform: active ? "none" : "translateX(3px)" },
                }}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 3,
                      background: accent.main,
                      border: `2px solid ${L.paper}`,
                      boxShadow: `3px 3px 0 rgba(239,233,220,0.85)`,
                    }}
                  />
                )}
                <Icon sx={{ position: "relative", fontSize: 21 }} />
                <Box component="span" sx={{ position: "relative", flexGrow: 1 }}>{link.label}</Box>
                {showBadge && (
                  <Badge
                    badgeContent={pendingApprovals}
                    color="warning"
                    sx={{ position: "relative", mr: 1.5, "& .MuiBadge-badge": { fontWeight: 800 } }}
                  />
                )}
              </Box>
            );
          })}
        </Stack>
      </LayoutGroup>

      {user && (
        <Box sx={{ position: "relative", p: 1.5 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ p: 1.5, borderRadius: "3px", bgcolor: "rgba(239,233,220,0.06)", border: "2px solid rgba(239,233,220,0.3)" }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "3px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT.wordmark,
                fontWeight: 900,
                letterSpacing: "0.04em",
                fontSize: 17,
                color: accent.text,
                background: accent.main,
                border: `2px solid ${L.paper}`,
              }}
            >
              {initials}
            </Box>
            <Box minWidth={0} flexGrow={1}>
              <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25 }}>
                {user.first_name ? `${user.first_name} ${user.last_name ?? ""}`.trim() : user.email}
              </Typography>
              <Typography noWrap sx={{ ...mono, fontSize: 10.5, color: "rgba(239,233,220,0.6)" }}>
                {ROLE_LABEL[user.role]}
              </Typography>
            </Box>
            <Tooltip title="Log out" arrow>
              <IconButton onClick={logout} size="small" aria-label="Log out" sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" } }}>
                <LogoutRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default", pb: { xs: 8, md: 0 } }}>
      <Box component="aside" sx={{ display: { xs: "none", md: "block" }, width: SIDEBAR_WIDTH, flexShrink: 0 }}>
        <Box sx={{ position: "fixed", top: 0, bottom: 0, left: 0, width: SIDEBAR_WIDTH }}>{sidebar}</Box>
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { md: "none" } }}
        slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH, border: 0 } } }}
      >
        {sidebar}
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            height: 68,
            px: { xs: 2, md: 4 },
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            bgcolor: (th) => alpha(th.palette.background.default, 0.92),
            backdropFilter: "blur(10px)",
            borderBottom: (th) => `2px solid ${th.palette.mode === "dark" ? "rgba(239,233,220,0.3)" : L.ink}`,
          }}
        >
          <IconButton onClick={() => setMobileOpen(true)} aria-label="Open menu" sx={{ display: { md: "none" }, ml: -1 }}>
            <MenuRoundedIcon />
          </IconButton>
          <Box flexGrow={1} minWidth={0}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current?.label ?? "home"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <Typography noWrap sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
                  {current?.label ?? "ThermaTrust"}
                </Typography>
              </motion.div>
            </AnimatePresence>
          </Box>
          {user && (
            <Box
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                alignItems: "center",
                px: 1.5,
                py: 0.6,
                borderRadius: "2px",
                ...mono,
                fontSize: 10.5,
                fontWeight: 700,
                bgcolor: accent.bg,
                color: L.ink,
                border: (th) => `1.5px solid ${th.palette.mode === "dark" ? "rgba(239,233,220,0.5)" : L.ink}`,
              }}
            >
              {ROLE_LABEL[user.role]}
            </Box>
          )}
          {user && (
            <>
              <SearchButton onClick={() => setSearchOpen(true)} />
              <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} arrow>
                <IconButton
                  onClick={toggle}
                  aria-label="Toggle dark mode"
                  sx={{ border: 2, borderColor: (th) => (th.palette.mode === "dark" ? "rgba(239,233,220,0.4)" : L.ink), bgcolor: "background.paper", borderRadius: "3px" }}
                >
                  {mode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                </IconButton>
              </Tooltip>
              <Box sx={{ bgcolor: "background.paper", borderRadius: "3px", border: 2, borderColor: (th) => (th.palette.mode === "dark" ? "rgba(239,233,220,0.4)" : L.ink), lineHeight: 0 }}>
                <AlertsBell />
              </Box>
            </>
          )}
        </Box>

        <OfflineBanner />

        <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, width: "100%", maxWidth: 1280, mx: "auto" }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      {user && (
        <Paper
          elevation={0}
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            borderRadius: 0,
            borderLeft: 0,
            borderRight: 0,
            borderBottom: 0,
            borderTop: 2,
            borderColor: (th) => (th.palette.mode === "dark" ? "rgba(239,233,220,0.3)" : L.ink),
            pb: "env(safe-area-inset-bottom)",
          }}
        >
          <BottomNavigation
            showLabels
            value={current ? current.to : false}
            sx={{ bgcolor: "transparent", height: 64 }}
          >
            {links.slice(0, 4).map((link) => {
              const Icon = link.icon;
              return (
                <BottomNavigationAction
                  key={link.to}
                  value={link.to}
                  component={RouterLink}
                  to={link.to}
                  label={link.label.length > 11 ? link.label.split(" ")[0] : link.label}
                  icon={<Icon />}
                  sx={{
                    minWidth: 0,
                    px: 0.5,
                    // The role accents are tuned for fills; as 11px text they need the darker shade on white
                    // (the technician orange is only 2.9:1) and a lighter one on the dark surface (admin slate).
                    "&.Mui-selected": { color: (theme) => (theme.palette.mode === "dark" ? lighten(accent.main, 0.5) : accent.dark) },
                    // MUI enlarges the selected label, which wraps it onto two lines and shifts the bar.
                    "& .MuiBottomNavigationAction-label, &.Mui-selected .MuiBottomNavigationAction-label": {
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    },
                  }}
                />
              );
            })}
            <BottomNavigationAction
              label="More"
              icon={<MoreHorizRoundedIcon />}
              onClick={() => setMobileOpen(true)}
              sx={{ minWidth: 0, px: 0.5, "& .MuiBottomNavigationAction-label": { fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" } }}
            />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
