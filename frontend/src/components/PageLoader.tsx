import { Box, Skeleton, Stack } from "@mui/material";

/** Shimmering placeholder shown while a page's data loads, shaped like a typical page. */
export function PageLoader({ rows = 4 }: { rows?: number }) {
  return (
    <Stack spacing={2.5} aria-busy="true" aria-label="Loading">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={92} sx={{ borderRadius: 4, animationDelay: `${i * 0.12}s` }} />
        ))}
      </Box>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: 3.5, opacity: 1 - i * 0.18 }} />
      ))}
    </Stack>
  );
}
