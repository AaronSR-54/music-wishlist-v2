# Spec Delta

## Purpose

Controls which language the app displays: it honors a saved user preference, otherwise detects the system/browser language, and defaults to English when neither applies.

## ADDED Requirements

### Requirement: Language resolution order
The app SHALL choose its display language by preferring a saved user preference, then the system/browser language when it is Spanish, and SHALL otherwise fall back to English.

#### Scenario: Saved preference takes precedence
- **WHEN** a saved language preference exists
- **THEN** the app displays that language on launch, regardless of the system/browser language

#### Scenario: Spanish system language
- **WHEN** there is no saved preference and the system/browser language is Spanish
- **THEN** the app displays Spanish

#### Scenario: Non-Spanish system language defaults to English
- **WHEN** there is no saved preference and the system/browser language is not Spanish
- **THEN** the app displays English

### Requirement: Document language matches the active language
The document's `lang` attribute SHALL reflect the active display language and SHALL default to English before the app initializes.

#### Scenario: Served default
- **WHEN** the page is delivered before the app selects a language
- **THEN** the `<html>` `lang` attribute is `en`

#### Scenario: Attribute follows the active language
- **WHEN** the app initializes or the user changes the language
- **THEN** the `<html>` `lang` attribute is set to the active language code (`en` or `es`)
