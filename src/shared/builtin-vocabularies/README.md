# Built-in Vocabularies

Add one `.csv` file per built-in vocabulary in this folder. The file name is
used as the stable vocabulary ID:

```text
family.csv -> builtin-family
```

Optional metadata can be added as comment lines before the CSV data:

```csv
# name: Семья
# description: Базовые слова про семью.
# category: nouns
отбасы,семья
әке,отец
```

Headerless CSV files are supported. In that case, the first column is treated as
Kazakh Cyrillic text and the second column is treated as Russian text.

Supported word columns:

- `id` or `wordId`: stable word ID. If omitted, one is generated from the file
  name and row number.
- `kk`, `source`, `sourceText`, or `kazakh`: Kazakh text.
- `kkCyrillic`, `sourceCyrillic`, or `cyrillic`: Kazakh Cyrillic variant.
- `kkLatin`, `sourceLatin`, or `latin`: Kazakh Latin variant.
- `ru`, `target`, `targetText`, or `russian`: Russian text.
- `level`: `A1`, `A2`, or `B1`. Defaults to `A2`.

If `kkCyrillic` is present, the app uses it as the main displayed Kazakh text
and keeps `kkLatin` as an alternate variant.
