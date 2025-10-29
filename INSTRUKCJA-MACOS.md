# Instrukcja uruchomienia na macOS

## Krok 1: Zainstaluj zależności (jeśli jeszcze nie są zainstalowane)

```bash
npm install
```

## Krok 2: Zbuduj aplikację

```bash
npm run build
```

To powinno zakończyć się sukcesem i utworzyć pliki w folderach:
- `dist/` - React frontend
- `dist-electron/` - Electron backend

## Krok 3: Uruchom aplikację

Masz dwie opcje:

### Opcja A: Tryb deweloperski (z hot-reload)
```bash
npm run dev
```

### Opcja B: Tryb produkcyjny (z zbudowanymi plikami)
```bash
npm run run-prod
```

### Opcja C: Użyj skryptu stealth-run.sh
```bash
chmod +x stealth-run.sh
./stealth-run.sh
```

## WAŻNE: Okno będzie niewidoczne!

Aplikacja uruchamia się w trybie niewidocznym. Aby zobaczyć okno:

**Naciśnij: `Cmd + B`** (lub `Ctrl + B`)

Możesz użyć tego skrótu wielokrotnie, aby pokazywać/ukrywać okno.

## Krok 4: Konfiguracja API Key

Po otworzeniu okna (Cmd+B):

1. **Jeśli pierwszy raz uruchamiasz:**
   - Zobaczysz ekran powitalny z przyciskiem "Open Settings"
   - Kliknij "Open Settings"
   
2. **Jeśli okno już działa:**
   - Kliknij ikonę **Settings** (⚙️) w górnym prawym rogu
   
3. **W oknie Settings:**
   - Wybierz **API Provider** (OpenAI, Gemini, lub Anthropic)
   - Wpisz swój **API Key** w pole hasła
   - Opcjonalnie wybierz modele dla Extraction, Solution i Debugging
   - Kliknij **"Save Settings"**
   - Aplikacja automatycznie się przeładuje

## Przydatne skróty klawiszowe

- `Cmd + B` - Pokaż/Ukryj okno (NAJWAŻNIEJSZE!)
- `Cmd + H` - Zrób screenshot
- `Cmd + L` - Usuń ostatni screenshot
- `Cmd + Enter` - Przetwórz screenshots (wygeneruj rozwiązanie)
- `Cmd + R` - Reset (nowy problem)
- `Cmd + Q` - Zamknij aplikację
- `Cmd + [ / ]` - Zmniejsz/Zwiększ przezroczystość okna
- Strzałki z `Cmd` - Przesuń okno

## Uprawnienia na macOS

Może być potrzebne nadanie uprawnień:

### Screen Recording (do robienia screenshotów)
1. System Settings → Privacy & Security → Screen Recording
2. Dodaj Terminal lub aplikację (jeśli już jest)
3. Uruchom ponownie aplikację

### Dostęp do plików (opcjonalnie)
W razie potrzeby w System Settings → Privacy & Security → Files and Folders

## Tworzenie pliku instalacyjnego (DMG)

Jeśli chcesz utworzyć plik `.dmg` do instalacji:

```bash
npm run package-mac
```

Plik będzie w folderze `release/` jako:
- `Interview-Coder-arm64.dmg` (dla Apple Silicon)
- `Interview-Coder-x64.dmg` (dla Intel Mac)

## Rozwiązywanie problemów

### Okno nie widoczne?
- Naciśnij `Cmd + B` kilka razy
- Sprawdź czy aplikacja działa w Activity Monitor

### Błędy przy starcie?
```bash
npm run clean
npm run build
npm run run-prod
```

### Problemy z API Key?
- Sprawdź czy klucz jest poprawny
- Sprawdź czy masz kredyty/limity w swoim koncie API
- Spróbuj wylogować się i zalogować ponownie (przycisk Log Out)

### Konfiguracja zapisana w:
`~/Library/Application Support/interview-coder-v1/config.json`

Możesz tam ręcznie sprawdzić/edytować konfigurację.

## Gotowe! 🎉

Aplikacja powinna teraz działać. Pamiętaj:
1. Użyj `Cmd + B` aby pokazać okno
2. Wpisz API Key w Settings
3. Zrób screenshot problemu (`Cmd + H`)
4. Przetwórz (`Cmd + Enter`)

Powodzenia na interview! 🚀


