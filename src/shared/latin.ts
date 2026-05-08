export const kazakhCyrillicToLatin = {
    А: "A",
    а: "a",

    Ә: "Ä",
    ә: "ä",

    Б: "B",
    б: "b",

    В: "V",
    в: "v",

    Г: "G",
    г: "g",

    Ғ: "Ğ",
    ғ: "ğ",

    Д: "D",
    д: "d",

    Е: "E",
    е: "e",

    Ё: "Ö",
    ё: "ö",

    Ж: "J",
    ж: "j",

    З: "Z",
    з: "z",

    И: "İ",
    и: "i",

    Й: "İ",
    й: "i",

    К: "K",
    к: "k",

    Қ: "Q",
    қ: "q",

    Л: "L",
    л: "l",

    М: "M",
    м: "m",

    Н: "N",
    н: "n",

    ң: "ñ",

    О: "O",
    о: "o",

    Ө: "Ö",
    ө: "ö",

    П: "P",
    п: "p",

    Р: "R",
    р: "r",

    С: "S",
    с: "s",

    Т: "T",
    т: "t",

    У: "U",
    у: "u",

    Ұ: "Ū",
    ұ: "ū",

    Ү: "Ü",
    ү: "ü",

    Ф: "F",
    ф: "f",

    Х: "H",
    х: "h",

    һ: "h",

    Ц: "S",
    ц: "s",

    Ч: "Ch",
    ч: "ch",

    Ш: "Ş",
    ш: "ş",

    Щ: "Ş",
    щ: "ş",

    Ы: "Y",
    ы: "y",

    І: "I",
    і: "ı",

    Э: "E",
    э: "e",

    Ю: "İu",
    ю: "iu",

    Я: "İa",
    я: "ia",
} as const;

const kazakhCyrillicPattern = new RegExp(
    `[${Object.keys(kazakhCyrillicToLatin).join("")}]`,
    "g",
);

export function kazakhCyrillicToLatinText(text: string): string {
    return text.replace(kazakhCyrillicPattern, (char) =>
        kazakhCyrillicToLatin[char as keyof typeof kazakhCyrillicToLatin],
    );
}
