import re


def normalize_phone_for_sms(phone: str) -> str:
    """Normalize a phone number into a format suitable for SMS delivery."""
    if not phone:
        return ""

    cleaned = phone.strip()
    if not cleaned:
        return ""

    digits_only = re.sub(r"\D", "", cleaned)
    if not digits_only:
        return cleaned

    if cleaned.startswith('+'):
        return cleaned

    if len(digits_only) == 10:
        return f"+91{digits_only}"

    if len(digits_only) == 11 and digits_only.startswith("0"):
        return f"+91{digits_only[1:]}"

    if len(digits_only) == 12 and digits_only.startswith("91"):
        return f"+{digits_only}"

    return f"+{digits_only}" if not digits_only.startswith("+") else cleaned
