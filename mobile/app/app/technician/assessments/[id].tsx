import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAssessment, submitAssessment } from '@/src/api/endpoints';
import { Assessment, AssessmentAttemptResult } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Chip } from '@/src/components/ui/Chip';
import { State } from '@/src/components/ui/kit';
import { Palette, useTheme } from '@/src/theme/ThemeProvider';

export default function AssessmentTakeScreen() {
  const { t } = useTheme();
  const styles = createStyles(t);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const assessmentId = Number(id);
  const queryClient = useQueryClient();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AssessmentAttemptResult | null>(null);

  const { data: assessment, isLoading, isError, refetch } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => fetchAssessment(assessmentId),
    enabled: Number.isInteger(assessmentId) && assessmentId > 0,
  });

  const submitMutation = useMutation({
    mutationFn: (answers: number[]) => submitAssessment(assessmentId, answers),
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['my-capabilities'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to submit assessment');
    },
  });

  const question = assessment?.questions?.[currentQuestion];

  const handleAnswer = (questionId: number, choiceIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: choiceIndex }));
  };

  const nextQuestion = () => {
    if (currentQuestion < (assessment?.questions.length || 0) - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < (assessment?.questions.length || 0)) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting');
      return;
    }
    const answerArray = assessment!.questions.map(q => answers[q.id] ?? -1);
    submitMutation.mutate(answerArray);
  };

  if (isLoading) {
    return (
      <ScreenContainer headerTitle="Assessment" showProfile={false}>
        <State loading />
      </ScreenContainer>
    );
  }

  if (isError || !assessment) {
    return (
      <ScreenContainer headerTitle="Assessment" showProfile={false}>
        {isError ? <State error onRetry={() => { void refetch(); }} /> : <State empty="Assessment not found." />}
      </ScreenContainer>
    );
  }

  if (submitted && result) {
    return (
      <ScreenContainer headerTitle="Assessment result" showProfile={false}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <Card style={styles.resultCard}>
            <View style={[
              styles.resultHeader,
              result.passed ? styles.resultPass : styles.resultFail,
            ]}>
              <Text style={styles.resultIcon}>{result.passed ? '✅' : '❌'}</Text>
              <Text style={styles.resultTitle}>{result.passed ? 'PASSED' : 'FAILED'}</Text>
              <Text style={styles.resultScore}>{result.score_percent}%</Text>
            </View>
            <View style={styles.resultDetails}>
              <View style={styles.resultDetail}>
                <Text style={styles.resultLabel}>Score</Text>
                <Text style={styles.resultValue}>{result.score_percent}%</Text>
              </View>
              <View style={styles.resultDetail}>
                <Text style={styles.resultLabel}>Pass Threshold</Text>
                <Text style={styles.resultValue}>{assessment.pass_score_percent}%</Text>
              </View>
              <View style={styles.resultDetail}>
                <Text style={styles.resultLabel}>Status</Text>
                <Chip variant={result.capability_status === 'verified' ? 'success' : 'default'} size="md">
                  {result.capability_status?.replace(/_/g, ' ') || 'Pending'}
                </Chip>
              </View>
            </View>
            {result.capability_status === 'verified' && (
              <View style={styles.verifiedBanner}>
                <Text style={styles.verifiedText}>🎉 Capability auto-verified!</Text>
              </View>
            )}
            <Button fullWidth onPress={() => router.back()} style={styles.doneBtn}>
              Done
            </Button>
          </Card>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const progress = ((currentQuestion + 1) / assessment.questions.length) * 100;

  return (
    <ScreenContainer headerTitle={assessment.title} showProfile={false}>
      <View style={styles.container}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressMeta}>
            <Text style={styles.progressLabel}>Question {currentQuestion + 1} of {assessment.questions.length}</Text>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Question */}
        {question && (
          <ScrollView contentContainerStyle={styles.questionContent}>
            <Card style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Chip variant="primary" size="sm">Question {currentQuestion + 1}</Chip>
                <Text style={styles.questionPrompt}>{question.prompt}</Text>
                <Text style={styles.questionHint}>Choose one answer</Text>
              </View>
              <CardContent>
                <View style={styles.choices}>
                  {question.choices.map((choice, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleAnswer(question.id, i)}
                      style={[
                        styles.choice,
                        answers[question.id] === i && styles.choiceSelected,
                      ]}
                    >
                      <View style={[styles.choiceLetter, answers[question.id] === i && styles.choiceLetterSelected]}>
                        <Text style={[styles.choiceLetterText, answers[question.id] === i && styles.choiceLetterTextSelected]}>{String.fromCharCode(65 + i)}</Text>
                      </View>
                      <Text style={[
                        styles.choiceText,
                        answers[question.id] === i && styles.choiceTextSelected,
                      ]}>
                        {choice}
                      </Text>
                      {answers[question.id] === i ? <Text style={styles.selectedMark}>✓</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </CardContent>
            </Card>
          </ScrollView>
        )}

        {/* Navigation */}
        <View style={styles.navBar}>
          <Button
            variant="outline"
            onPress={prevQuestion}
            disabled={currentQuestion === 0}
            style={styles.navBtn}
          >
            Previous
          </Button>
          {currentQuestion === assessment.questions.length - 1 ? (
            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={submitMutation.isPending}
              style={styles.navBtn}
            >
              Submit Assessment
            </Button>
          ) : (
            <Button
              variant="primary"
              onPress={nextQuestion}
              disabled={!question || answers[question.id] === undefined}
              style={styles.navBtn}
            >
              Next
            </Button>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1 },
  progressContainer: { paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.line, backgroundColor: t.card },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 12, color: t.text, fontWeight: '700' },
  progressBar: { height: 7, backgroundColor: t.field, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: t.primary, borderRadius: 3 },
  progressText: { fontSize: 12, color: t.primary, fontWeight: '800' },
  questionContent: { flexGrow: 1, padding: 16, paddingBottom: 24 },
  questionCard: { padding: 0, overflow: 'hidden' },
  questionHeader: { padding: 18, backgroundColor: t.field, borderBottomWidth: 1, borderBottomColor: t.line },
  questionPrompt: { fontSize: 18, lineHeight: 25, color: t.text, fontWeight: '800', marginTop: 12 },
  questionHint: { fontSize: 11, color: t.sub, marginTop: 7 },
  choices: { gap: 10, padding: 16 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderWidth: 1.5, borderColor: t.line, borderRadius: 14, backgroundColor: t.card, minHeight: 58 },
  choiceSelected: { borderColor: t.primary, backgroundColor: t.tint },
  choiceLetter: { width: 30, height: 30, borderWidth: 1, borderColor: t.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.field },
  choiceLetterSelected: { borderColor: t.primary, backgroundColor: t.primary },
  choiceLetterText: { fontSize: 12, color: t.sub, fontWeight: '800' },
  choiceLetterTextSelected: { color: '#FFFFFF' },
  choiceText: { fontSize: 14, color: t.text, flex: 1 },
  choiceTextSelected: { color: t.primary, fontWeight: '700' },
  selectedMark: { fontSize: 18, color: t.primary, fontWeight: '900' },
  navBar: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.card },
  navBtn: { flex: 1 },
  resultContent: { padding: 16, paddingBottom: 100 },
  resultCard: { padding: 0 },
  resultHeader: { padding: 24, alignItems: 'center', gap: 12 },
  resultPass: { backgroundColor: t.okBg },
  resultFail: { backgroundColor: t.badBg },
  resultIcon: { fontSize: 48 },
  resultTitle: { fontSize: 24, fontWeight: '700', color: t.text },
  resultScore: { fontSize: 32, fontWeight: '800', color: t.text },
  resultDetails: { padding: 24, gap: 16 },
  resultDetail: { alignItems: 'center' },
  resultLabel: { fontSize: 12, color: t.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  resultValue: { fontSize: 20, fontWeight: '700', color: t.text },
  verifiedBanner: { padding: 16, backgroundColor: t.okBg, borderTopWidth: 1, borderTopColor: t.ok },
  verifiedText: { fontSize: 14, fontWeight: '600', color: t.ok, textAlign: 'center' },
  doneBtn: { margin: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});