import { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, Stack, TextField } from "@mui/material";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import {
  countryOptions, exampleNumber, findCountry, guessCountry, isPhoneValid, maxDigits, splitPhone, toInternational,
  type CountryOption,
} from "../lib/phone";

interface PhoneFieldProps {
  label: string;
  /** International form ("+919876543210") or empty. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Shown instead of the built-in message, e.g. an error returned by the server. */
  error?: string;
}

/** Country picker plus a number box that only accepts as many digits as that country allows. */
export function PhoneField({ label, value, onChange, required, error }: PhoneFieldProps) {
  const [country, setCountry] = useState<CountryCode>("IN");
  const [digits, setDigits] = useState("");
  const [touched, setTouched] = useState(false);

  // Start from the visitor's own country (after hydration, so server and browser agree).
  useEffect(() => {
    if (!value) setCountry(guessCountry());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the parent when it replaces the value (a form being reset, or an existing number loading).
  useEffect(() => {
    if (value !== toInternational(country, digits)) {
      const next = splitPhone(value, country);
      setCountry(next.country);
      setDigits(next.digits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const cap = useMemo(() => maxDigits(country), [country]);
  const example = useMemo(() => exampleNumber(country), [country]);
  const current = findCountry(country);
  const international = toInternational(country, digits);
  const invalid = digits.length > 0 && !isPhoneValid(international);
  const showError = invalid && (touched || digits.length >= example.digits);

  function update(nextCountry: CountryCode, nextDigits: string) {
    setCountry(nextCountry);
    setDigits(nextDigits);
    onChange(toInternational(nextCountry, nextDigits));
  }

  function handleInput(raw: string) {
    // A pasted international number ("+91 98765 43210") picks its own country.
    if (raw.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(raw);
      if (parsed?.country) {
        update(parsed.country, parsed.nationalNumber.slice(0, maxDigits(parsed.country)));
        return;
      }
    }
    update(country, raw.replace(/\D/g, "").slice(0, cap));
  }

  const hint = example.text ? `For example ${example.text}${example.digits ? ` (${example.digits} digits)` : ""}` : " ";
  const message =
    error ||
    (showError ? `That is not a valid ${current.name} number. ${hint}.` : hint);

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Autocomplete<CountryOption, false, true>
        disableClearable
        options={countryOptions()}
        value={current}
        onChange={(_event, option) => update(option.code, digits.slice(0, maxDigits(option.code)))}
        isOptionEqualToValue={(option, selected) => option.code === selected.code}
        getOptionLabel={(option) => `${option.code} +${option.dial}`}
        filterOptions={(options, { inputValue }) => {
          const q = inputValue.trim().toLowerCase().replace(/^\+/, "");
          if (!q) return options;
          return options.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase() === q || o.dial.startsWith(q));
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props as typeof props & { key: string };
          return (
            <Box component="li" key={key} {...rest} sx={{ gap: 1 }}>
              <Box component="span" sx={{ flexGrow: 1 }}>{option.name}</Box>
              <Box component="span" sx={{ color: "text.secondary" }}>+{option.dial}</Box>
            </Box>
          );
        }}
        slotProps={{ listbox: { sx: { minWidth: 260 } } }}
        sx={{ width: 138, flexShrink: 0 }}
        renderInput={(params) => <TextField {...params} label="Country" />}
      />
      <TextField
        label={label}
        value={digits}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={() => setTouched(true)}
        required={required}
        fullWidth
        error={Boolean(error) || showError}
        helperText={message}
        type="tel"
        autoComplete="tel-national"
        slotProps={{ htmlInput: { inputMode: "numeric", "aria-label": `${label}, ${current.name}` } }}
      />
    </Stack>
  );
}
