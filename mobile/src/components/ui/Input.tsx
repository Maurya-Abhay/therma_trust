import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

interface InputProps extends Omit<TextInputProps, 'onChangeText' | 'value' | 'defaultValue'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  value?: string;
  onChangeText?: (text: string) => void;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  className?: string;
}

export const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, value, onChangeText, style, inputStyle, containerStyle, fieldStyle, editable = true, onFocus, onBlur, className, ...props }, ref) => {
    const { t } = useTheme();
    const hasError = Boolean(error);

    return (
      <View className={className} style={[styles.container, containerStyle, style]}>
        {label ? <Text style={[styles.label, { color: t.sub }]}>{label}</Text> : null}
        <View style={[styles.field, { backgroundColor: t.field, borderColor: hasError ? t.bad : t.line }, !editable && styles.fieldDisabled, fieldStyle]}>
          {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            editable={editable}
            placeholderTextColor={t.sub}
            selectionColor={t.primary}
            underlineColorAndroid="transparent"
            onFocus={onFocus}
            onBlur={onBlur}
            style={[
              styles.textInput,
              { color: t.text },
              leftIcon ? styles.inputWithLeftIcon : undefined,
              rightIcon ? styles.inputWithRightIcon : undefined,
              !editable ? styles.disabledText : undefined,
              inputStyle,
            ]}
            {...props}
          />
          {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
        </View>
        {hasError ? <Text style={[styles.errorText, { color: t.bad }]}>{error}</Text> : helperText ? <Text style={[styles.helperText, { color: t.sub }]}>{helperText}</Text> : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.15 },
  field: { minHeight: 54, width: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16 },
  fieldDisabled: { opacity: 0.65 },
  textInput: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14 },
  inputWithLeftIcon: { paddingLeft: 8 },
  inputWithRightIcon: { paddingRight: 8 },
  leftIcon: { paddingLeft: 14, alignItems: 'center', justifyContent: 'center' },
  rightIcon: { paddingRight: 12, alignItems: 'center', justifyContent: 'center' },
  disabledText: { opacity: 0.7 },
  errorText: { fontSize: 11, marginTop: 6, fontWeight: '600' },
  helperText: { fontSize: 11, marginTop: 6, lineHeight: 16 },
});
