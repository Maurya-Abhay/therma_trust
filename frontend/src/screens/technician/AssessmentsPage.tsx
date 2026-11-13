import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { fetchAssessments } from "../../api/endpoints";
import { PageLoader } from "../../components/PageLoader";
import { PageHeader } from "../../components/PageHeader";

import { useLabels } from "../../lib/labels";

export function AssessmentsPage() {
  const labels = useLabels();
  const { data: assessments, isLoading } = useQuery({ queryKey: ["assessments"], queryFn: fetchAssessments });

  return (
    <Box>
      <PageHeader title="Practical Assessments" subtitle="Pass a scored test to verify a capability on the spot." mb={3} />
      <Typography variant="body2" color="text.secondary" mb={3}>
        Pass a short scored test and the matching capability is verified automatically —
        no need to wait on a contractor manager or admin for these.
      </Typography>

      {isLoading && <PageLoader />}

      <Stack spacing={2}>
        {assessments?.map((a) => (
          <Paper key={a.id} sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="subtitle1">{a.title}</Typography>
              <Stack direction="row" spacing={1} mt={0.5}>
                <Chip size="small" label={labels.capabilityType(a.capability_type)} />
                <Chip size="small" label={a.target_label} variant="outlined" />
                <Chip size="small" label={`${a.questions.length} questions`} variant="outlined" />
                <Chip size="small" label={`Pass at ${a.pass_score_percent}%`} variant="outlined" />
              </Stack>
            </Box>
            <Button variant="contained" component={RouterLink} to={`/assessments/${a.id}`}>
              Take assessment
            </Button>
          </Paper>
        ))}
        {assessments?.length === 0 && (
          <Typography color="text.secondary">No assessments available yet.</Typography>
        )}
      </Stack>
    </Box>
  );
}
