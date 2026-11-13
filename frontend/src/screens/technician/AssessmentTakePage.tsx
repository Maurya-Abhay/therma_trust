import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, FormControlLabel, Paper, Radio, RadioGroup, Typography,
} from "@mui/material";
import { fetchAssessment, submitAssessment } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { PageLoader } from "../../components/PageLoader";

export function AssessmentTakePage() {
  const { id } = useParams();
  const assessmentId = Number(id);
  const navigate = useNavigate();

  const { data: assessment, isLoading } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => fetchAssessment(assessmentId),
  });

  const [answers, setAnswers] = useState<Record<number, number>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const ordered = assessment!.questions.map((q) => answers[q.id]);
      return submitAssessment(assessmentId, ordered);
    },
  });

  if (isLoading || !assessment) return <PageLoader />;

  const allAnswered = assessment.questions.every((q) => answers[q.id] !== undefined);

  if (mutation.isSuccess) {
    const result = mutation.data;
    return (
      <Box maxWidth={600}>
        <Typography variant="h4" mb={2}>{assessment.title}</Typography>
        <Paper sx={{ p: 3 }}>
          <Alert severity={result.passed ? "success" : "warning"} sx={{ mb: 2 }}>
            {result.passed
              ? `Passed with ${result.score_percent}% — capability marked ${result.capability_status}.`
              : `Scored ${result.score_percent}%, below the ${assessment.pass_score_percent}% pass mark. No capability was changed — you can try again.`}
          </Alert>
          <Button variant="contained" onClick={() => navigate("/assessments")}>
            Back to assessments
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box maxWidth={700}>
      <Typography variant="h4" mb={1}>{assessment.title}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {assessment.questions.length} questions &middot; pass at {assessment.pass_score_percent}%
      </Typography>

      {assessment.questions.map((q, i) => (
        <Paper key={q.id} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" mb={1}>{i + 1}. {q.prompt}</Typography>
          <RadioGroup
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers({ ...answers, [q.id]: Number(e.target.value) })}
          >
            {q.choices.map((choice, choiceIndex) => (
              <FormControlLabel
                key={choiceIndex}
                value={choiceIndex}
                control={<Radio />}
                label={choice}
              />
            ))}
          </RadioGroup>
        </Paper>
      ))}

      {mutation.isError && <Alert severity="error" sx={{ mb: 2 }}>{getErrorMessage(mutation.error)}</Alert>}

      <Button
        variant="contained"
        onClick={() => mutation.mutate()}
        disabled={!allAnswered || mutation.isPending}
      >
        {mutation.isPending ? "Submitting..." : "Submit"}
      </Button>
    </Box>
  );
}
