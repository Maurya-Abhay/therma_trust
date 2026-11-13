import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Dialog, IconButton, InputBase, Stack, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import AcUnitRoundedIcon from "@mui/icons-material/AcUnitRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PropaneTankRoundedIcon from "@mui/icons-material/PropaneTankRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import KeyboardReturnRoundedIcon from "@mui/icons-material/KeyboardReturnRounded";
import { searchEverything } from "../api/endpoints";
import type { SearchResult } from "../types";

const ICONS: Record<SearchResult["type"], typeof SearchRoundedIcon> = {
  facility: ApartmentRoundedIcon,
  equipment: AcUnitRoundedIcon,
  job: WorkRoundedIcon,
  technician: PersonRoundedIcon,
  cylinder: PropaneTankRoundedIcon,
  credential: VerifiedUserRoundedIcon,
};

const LABELS: Record<SearchResult["type"], string> = {
  facility: "Facility",
  equipment: "Equipment",
  job: "Job",
  technician: "Technician",
  cylinder: "Cylinder",
  credential: "Credential",
};

/** Opens with the button or Ctrl/Cmd+K; searches everything the user can see. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(text.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [text]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchEverything(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 15_000,
  });

  const items = useMemo(() => (debounced.length >= 2 ? results : []), [debounced, results]);

  useEffect(() => {
    setActive(0);
  }, [items]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function close() {
    onClose();
    setText("");
    setDebounced("");
  }

  function choose(result: SearchResult | undefined) {
    if (!result) return;
    close();
    navigate(result.link);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(items[active]);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { position: "absolute", top: { xs: 24, sm: 96 }, m: 0, width: "calc(100% - 32px)" } } }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: "divider" }}>
        <SearchRoundedIcon sx={{ color: "text.secondary" }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Search facilities, equipment, jobs..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          inputProps={{ "aria-label": "Search" }}
          sx={{ fontSize: 17, fontWeight: 500 }}
        />
        <Box
          component="kbd"
          sx={{ fontSize: 11, fontWeight: 700, px: 0.75, py: 0.25, borderRadius: 1, border: 1, borderColor: "divider", color: "text.secondary" }}
        >
          Esc
        </Box>
      </Stack>

      <Box ref={listRef} sx={{ maxHeight: 380, overflowY: "auto", p: 1 }}>
        {debounced.length < 2 && (
          <Typography sx={{ p: 2.5, color: "text.secondary", fontSize: 14.5 }}>
            Type at least two letters. Results only include things you have access to.
          </Typography>
        )}
        {debounced.length >= 2 && items.length === 0 && !isFetching && (
          <Typography sx={{ p: 2.5, color: "text.secondary", fontSize: 14.5 }}>Nothing found for "{debounced}".</Typography>
        )}
        {items.map((item, index) => {
          const Icon = ICONS[item.type];
          const selected = index === active;
          return (
            <Stack
              key={`${item.type}-${item.id}`}
              data-index={index}
              direction="row"
              alignItems="center"
              spacing={1.75}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(item)}
              sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: 2.5,
                cursor: "pointer",
                bgcolor: selected ? "action.selected" : "transparent",
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "action.hover",
                  color: "primary.main",
                  flexShrink: 0,
                }}
              >
                <Icon fontSize="small" />
              </Box>
              <Box flexGrow={1} minWidth={0}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: 14.5 }}>{item.title}</Typography>
                <Typography noWrap sx={{ fontSize: 12.5, color: "text.secondary" }}>
                  {LABELS[item.type]}
                  {item.subtitle ? ` · ${item.subtitle}` : ""}
                </Typography>
              </Box>
              {selected && <KeyboardReturnRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />}
            </Stack>
          );
        })}
      </Box>
    </Dialog>
  );
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-label="Search"
        sx={{
          display: { xs: "none", sm: "flex" },
          alignItems: "center",
          gap: 1,
          px: 1.5,
          height: 40,
          minWidth: 220,
          borderRadius: 3,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "text.secondary",
          font: "inherit",
          fontSize: 14,
          cursor: "pointer",
          transition: "border-color 0.2s ease",
          "&:hover": { borderColor: "text.secondary" },
        }}
      >
        <SearchRoundedIcon sx={{ fontSize: 19 }} />
        <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>Search</Box>
        <Box component="kbd" sx={{ fontSize: 11, fontWeight: 700, px: 0.75, py: 0.2, borderRadius: 1, border: 1, borderColor: "divider" }}>
          Ctrl K
        </Box>
      </Box>
      <IconButton
        onClick={onClick}
        aria-label="Search"
        sx={{ display: { xs: "inline-flex", sm: "none" }, border: 1, borderColor: "divider", bgcolor: "background.paper" }}
      >
        <SearchRoundedIcon />
      </IconButton>
    </>
  );
}
