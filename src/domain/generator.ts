import { OPERATION_META } from './levels';
import type { DifficultyLevel, Operation, Question } from './types';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function formatNum(n: number): string {
  return n >= 1000 ? n.toLocaleString('en-US') : String(n);
}

interface RawQuestion {
  a: number;
  b: number;
  answer: number;
  strategy?: string;
  skillTag?: string;
}

function generateAddition(level: DifficultyLevel): RawQuestion {
  switch (level) {
    case 1: {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const answer = a + b;
      const strategy =
        answer > 10
          ? `Make 10: ${a} + ${10 - a} + ${b - (10 - a)} = ${answer}`
          : undefined;
      return { a, b, answer, strategy, skillTag: 'add-single' };
    }
    case 2: {
      const aTens = randInt(1, 7);
      const bTens = randInt(1, 8 - aTens);
      const aOnes = randInt(1, 8);
      const bOnes = randInt(1, 9 - aOnes);
      const a = aTens * 10 + aOnes;
      const b = bTens * 10 + bOnes;
      const answer = a + b;
      return {
        a,
        b,
        answer,
        strategy: `Add tens then ones: (${aTens * 10} + ${bTens * 10}) + (${aOnes} + ${bOnes}) = ${answer}`,
        skillTag: 'add-no-carry',
      };
    }
    case 3: {
      const aTens = randInt(1, 8);
      const bTens = randInt(1, 8);
      const aOnes = randInt(2, 9);
      const bOnes = randInt(10 - aOnes, 9);
      const a = aTens * 10 + aOnes;
      const b = bTens * 10 + bOnes;
      const answer = a + b;
      return {
        a,
        b,
        answer,
        strategy: `Left-to-right: ${a} + ${bTens * 10} = ${a + bTens * 10}, + ${bOnes} = ${answer}`,
        skillTag: 'add-carry',
      };
    }
    case 4: {
      const a = randInt(125, 785);
      const b = randInt(125, 685);
      const answer = a + b;
      const bH = Math.floor(b / 100) * 100;
      const bRest = b - bH;
      return {
        a,
        b,
        answer,
        strategy: `Chunk hundreds first: (${a} + ${bH}) + ${bRest} = ${a + bH} + ${bRest} = ${answer}`,
        skillTag: 'add-3digit',
      };
    }
    case 5: {
      const a = randInt(115, 495) * 10 + randInt(0, 9);
      const b = randInt(115, 485) * 10 + randInt(0, 9);
      const answer = a + b;
      const bTh = Math.floor(b / 1000) * 1000;
      const bRem = b - bTh;
      return {
        a,
        b,
        answer,
        strategy: `Add thousands first: ${formatNum(a + bTh)} + ${bRem} = ${formatNum(answer)}`,
        skillTag: 'add-large',
      };
    }
    case 6: {
      const round = pick([100, 200, 300, 400, 500]);
      const delta = randInt(1, 5);
      const b = round - delta;
      const a = randInt(135, 685);
      const answer = a + b;
      return {
        a,
        b,
        answer,
        strategy: `Round and compensate: ${a} + ${round} − ${delta} = ${a + round} − ${delta} = ${answer}`,
        skillTag: 'add-compensation',
      };
    }
    case 7: {
      const a = randInt(2150, 8850);
      const b = randInt(1450, 7850);
      const answer = a + b;
      const nextH = Math.ceil(b / 100) * 100;
      const diff = nextH - b;
      const strategy =
        diff > 0 && diff <= 40
          ? `Round up: ${formatNum(a)} + ${formatNum(nextH)} − ${diff} = ${formatNum(answer)}`
          : `Left-to-right: ${formatNum(Math.floor(a / 100) * 100 + Math.floor(b / 100) * 100)} + ${(a % 100) + (b % 100)} = ${formatNum(answer)}`;
      return { a, b, answer, strategy, skillTag: 'add-advanced' };
    }
  }
}

function generateSubtraction(level: DifficultyLevel): RawQuestion {
  switch (level) {
    case 1: {
      const a = randInt(3, 9);
      const b = randInt(1, a - 1);
      return { a, b, answer: a - b, skillTag: 'sub-single' };
    }
    case 2: {
      const aTens = randInt(3, 9);
      const bTens = randInt(1, aTens - 1);
      const aOnes = randInt(2, 9);
      const bOnes = randInt(1, aOnes - 1);
      const a = aTens * 10 + aOnes;
      const b = bTens * 10 + bOnes;
      const answer = a - b;
      return {
        a,
        b,
        answer,
        strategy: `Subtract tens then ones: (${aTens * 10} − ${bTens * 10}) + (${aOnes} − ${bOnes}) = ${answer}`,
        skillTag: 'sub-no-borrow',
      };
    }
    case 3: {
      const aTens = randInt(3, 9);
      const bTens = randInt(1, aTens - 1);
      const aOnes = randInt(0, 7);
      const bOnes = randInt(aOnes + 1, 9);
      const a = aTens * 10 + aOnes;
      const b = bTens * 10 + bOnes;
      const answer = a - b;
      const nextTen = Math.ceil(b / 10) * 10;
      const up = nextTen - b;
      return {
        a,
        b,
        answer,
        strategy: `Round subtrahend: ${a} − ${nextTen} + ${up} = ${a - nextTen} + ${up} = ${answer}`,
        skillTag: 'sub-borrow',
      };
    }
    case 4: {
      const a = randInt(260, 940);
      const b = randInt(115, a - 45);
      const answer = a - b;
      const bH = Math.floor(b / 100) * 100;
      const bRest = b - bH;
      return {
        a,
        b,
        answer,
        strategy: `Subtract hundreds first: ${a} − ${bH} = ${a - bH}, − ${bRest} = ${answer}`,
        skillTag: 'sub-3digit',
      };
    }
    case 5: {
      const a = randInt(2600, 8900);
      const b = randInt(1150, a - 350);
      const answer = a - b;
      const bTh = Math.floor(b / 1000) * 1000;
      return {
        a,
        b,
        answer,
        strategy: `Subtract thousands first: ${formatNum(a - bTh)} − ${b - bTh} = ${formatNum(answer)}`,
        skillTag: 'sub-large',
      };
    }
    case 6: {
      if (Math.random() < 0.5) {
        const a = pick([500, 600, 800, 1000, 1200]);
        const b = randInt(123, a - 115);
        const answer = a - b;
        return {
          a,
          b,
          answer,
          strategy: `Complement from ${formatNum(a - 1)}: (${formatNum(a - 1)} − ${b}) + 1 = ${formatNum(answer)}`,
          skillTag: 'sub-complement',
        };
      }
      const round = pick([100, 200, 300, 400]);
      const delta = randInt(1, 5);
      const b = round - delta;
      const a = randInt(round + 85, 950);
      const answer = a - b;
      return {
        a,
        b,
        answer,
        strategy: `Round and add back: ${a} − ${round} + ${delta} = ${a - round} + ${delta} = ${answer}`,
        skillTag: 'sub-compensation',
      };
    }
    case 7: {
      const a = randInt(4200, 9850);
      const b = randInt(1450, a - 500);
      const answer = a - b;
      const nextH = Math.ceil(b / 100) * 100;
      const diff = nextH - b;
      return {
        a,
        b,
        answer,
        strategy: `Round up to ${formatNum(nextH)}: ${formatNum(a)} − ${formatNum(nextH)} + ${diff} = ${formatNum(answer)}`,
        skillTag: 'sub-advanced',
      };
    }
  }
}

function generateMultiplication(level: DifficultyLevel): RawQuestion {
  switch (level) {
    case 1: {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const answer = a * b;
      let strategy: string | undefined;
      if (b === 9 || a === 9) {
        const other = a === 9 ? b : a;
        strategy = `Multiply by 10 and subtract: ${other} × 10 − ${other} = ${answer}`;
      } else if (b === 4 || a === 4) {
        const other = a === 4 ? b : a;
        strategy = `Double twice: ${other} → ${other * 2} → ${answer}`;
      }
      return { a, b, answer, strategy, skillTag: 'mul-single' };
    }
    case 2: {
      const a = randInt(12, 48);
      const b = randInt(2, 6);
      const answer = a * b;
      const tens = Math.floor(a / 10) * 10;
      const ones = a % 10;
      return {
        a,
        b,
        answer,
        strategy: `Split place values: (${tens} × ${b}) + (${ones} × ${b}) = ${tens * b} + ${ones * b} = ${answer}`,
        skillTag: 'mul-2x1',
      };
    }
    case 3: {
      if (Math.random() < 0.5) {
        const a = randInt(12, 19);
        const b = randInt(12, 19);
        const answer = a * b;
        return {
          a,
          b,
          answer,
          strategy: `Teens shortcut: (${a} + ${b % 10}) × 10 + (${a % 10} × ${b % 10}) = ${(a + (b % 10)) * 10} + ${(a % 10) * (b % 10)} = ${answer}`,
          skillTag: 'mul-teens',
        };
      }
      const a = randInt(35, 95);
      const b = randInt(6, 9);
      const answer = a * b;
      const tens = Math.floor(a / 10) * 10;
      const ones = a % 10;
      return {
        a,
        b,
        answer,
        strategy: `Distribute: (${tens} × ${b}) + (${ones} × ${b}) = ${tens * b} + ${ones * b} = ${answer}`,
        skillTag: 'mul-carry',
      };
    }
    case 4: {
      const a = randInt(21, 68);
      const b = randInt(14, 49);
      const answer = a * b;
      const bTens = Math.floor(b / 10) * 10;
      const bOnes = b % 10;
      return {
        a,
        b,
        answer,
        strategy: `Split ${b}: (${a} × ${bTens}) + (${a} × ${bOnes}) = ${formatNum(a * bTens)} + ${formatNum(a * bOnes)} = ${formatNum(answer)}`,
        skillTag: 'mul-2x2',
      };
    }
    case 5: {
      const a = randInt(112, 465);
      const b = randInt(4, 9);
      const answer = a * b;
      const h = Math.floor(a / 100) * 100;
      const rem = a - h;
      return {
        a,
        b,
        answer,
        strategy: `Split hundreds: (${h} × ${b}) + (${rem} × ${b}) = ${formatNum(h * b)} + ${formatNum(rem * b)} = ${formatNum(answer)}`,
        skillTag: 'mul-3x1',
      };
    }
    case 6: {
      const variant = randInt(0, 4);
      if (variant === 0) {
        // × 25
        const k = randInt(4, 24);
        const a = k * 4;
        const b = 25;
        return {
          a,
          b,
          answer: a * b,
          strategy: `Divide by 4, multiply by 100: (${a} ÷ 4) × 100 = ${k} × 100 = ${formatNum(a * b)}`,
          skillTag: 'mul-x25',
        };
      }
      if (variant === 1) {
        // × 5
        const a = randInt(14, 98) * 2;
        const b = 5;
        return {
          a,
          b,
          answer: a * b,
          strategy: `Halve and multiply by 10: (${a} ÷ 2) × 10 = ${a / 2} × 10 = ${formatNum(a * b)}`,
          skillTag: 'mul-x5',
        };
      }
      if (variant === 2) {
        // × 11
        const a = randInt(12, 89);
        const b = 11;
        return {
          a,
          b,
          answer: a * b,
          strategy: `Multiply by 10 and add: ${a} × 10 + ${a} = ${a * 10} + ${a} = ${formatNum(a * b)}`,
          skillTag: 'mul-x11',
        };
      }
      if (variant === 3) {
        // × 15
        const a = randInt(12, 46) * 2;
        const b = 15;
        return {
          a,
          b,
          answer: a * b,
          strategy: `Add half, then × 10: (${a} + ${a / 2}) × 10 = ${a + a / 2} × 10 = ${formatNum(a * b)}`,
          skillTag: 'mul-x15',
        };
      }
      // × 99
      const a = randInt(14, 85);
      const b = 99;
      return {
        a,
        b,
        answer: a * b,
        strategy: `Multiply by 100 and subtract: ${formatNum(a * 100)} − ${a} = ${formatNum(a * b)}`,
        skillTag: 'mul-x99',
      };
    }
    case 7: {
      const a = randInt(42, 98);
      const b = randInt(34, 96);
      const answer = a * b;
      const nextTen = Math.ceil(b / 10) * 10;
      const diff = nextTen - b;
      const strategy =
        diff > 0 && diff <= 3
          ? `Round up ${b} to ${nextTen}: (${a} × ${nextTen}) − (${a} × ${diff}) = ${formatNum(answer)}`
          : `Split ${b}: (${a} × ${Math.floor(b / 10) * 10}) + (${a} × ${b % 10}) = ${formatNum(answer)}`;
      return { a, b, answer, strategy, skillTag: 'mul-advanced' };
    }
  }
}

function generateDivision(level: DifficultyLevel): RawQuestion {
  switch (level) {
    case 1: {
      const b = randInt(2, 9);
      const answer = randInt(2, 9);
      const a = b * answer;
      return { a, b, answer, skillTag: 'div-basic' };
    }
    case 2: {
      const b = randInt(2, 9);
      const minQ = Math.ceil(16 / b);
      const maxQ = Math.floor(99 / b);
      const answer = randInt(Math.max(4, minQ), Math.max(5, maxQ));
      const a = b * answer;
      return {
        a,
        b,
        answer,
        strategy: `Break dividend: (${Math.floor(answer / 10) * 10 * b} ÷ ${b}) + (${(answer % 10) * b} ÷ ${b}) = ${answer}`,
        skillTag: 'div-2by1',
      };
    }
    case 3: {
      const b = randInt(3, 9);
      const minQ = Math.ceil(105 / b);
      const maxQ = Math.min(135, Math.floor(990 / b));
      const answer = randInt(minQ, maxQ);
      const a = b * answer;
      return {
        a,
        b,
        answer,
        strategy: `Chunk by multiples of ${b * 10}: start with ${Math.floor(answer / 10) * 10} × ${b} = ${Math.floor(answer / 10) * 10 * b}`,
        skillTag: 'div-3by1',
      };
    }
    case 4: {
      const b = randInt(11, 19);
      const answer = randInt(12, 36);
      const a = b * answer;
      return {
        a,
        b,
        answer,
        strategy: `Estimate tens first: ${b} × ${Math.floor(answer / 10) * 10} = ${b * Math.floor(answer / 10) * 10}, remainder ${a - b * Math.floor(answer / 10) * 10} ÷ ${b} = ${answer % 10}`,
        skillTag: 'div-2digit',
      };
    }
    case 5: {
      const b = randInt(12, 26);
      const answer = randInt(42, 118);
      const a = b * answer;
      return {
        a,
        b,
        answer,
        strategy: `Factor or chunk: ${b} × ${Math.floor(answer / 10) * 10} = ${formatNum(b * Math.floor(answer / 10) * 10)}, then divide remainder`,
        skillTag: 'div-large',
      };
    }
    case 6: {
      const variant = randInt(0, 3);
      if (variant === 0) {
        // ÷ 5
        const answer = randInt(14, 145);
        const a = answer * 5;
        return {
          a,
          b: 5,
          answer,
          strategy: `Double and divide by 10: (${a} × 2) ÷ 10 = ${a * 2} ÷ 10 = ${answer}`,
          skillTag: 'div-by5',
        };
      }
      if (variant === 1) {
        // ÷ 25
        const answer = randInt(8, 48);
        const a = answer * 25;
        return {
          a,
          b: 25,
          answer,
          strategy: `Multiply by 4 and divide by 100: (${formatNum(a)} × 4) ÷ 100 = ${formatNum(a * 4)} ÷ 100 = ${answer}`,
          skillTag: 'div-by25',
        };
      }
      if (variant === 2) {
        // ÷ 4
        const answer = randInt(18, 125);
        const a = answer * 4;
        return {
          a,
          b: 4,
          answer,
          strategy: `Halve twice: ${a} → ${a / 2} → ${answer}`,
          skillTag: 'div-by4',
        };
      }
      // ÷ 15
      const answer = randInt(12, 64);
      const a = answer * 15;
      return {
        a,
        b: 15,
        answer,
        strategy: `Double and divide by 30: (${formatNum(a)} × 2) ÷ 30 = ${formatNum(a * 2)} ÷ 30 = ${answer}`,
        skillTag: 'div-by15',
      };
    }
    case 7: {
      const b = randInt(21, 46);
      const answer = randInt(52, 138);
      const a = b * answer;
      return {
        a,
        b,
        answer,
        strategy: `Estimate ${b} × ${Math.floor(answer / 10) * 10} = ${formatNum(b * Math.floor(answer / 10) * 10)}, then divide remaining ${a - b * Math.floor(answer / 10) * 10}`,
        skillTag: 'div-advanced',
      };
    }
  }
}

export function generateQuestion(
  operation: Operation,
  level: DifficultyLevel,
  recentKeys?: Set<string>,
): Question {
  const symbol = OPERATION_META[operation].symbol;
  let raw: RawQuestion = { a: 0, b: 0, answer: 0 };

  for (let attempt = 0; attempt < 25; attempt++) {
    switch (operation) {
      case 'addition':
        raw = generateAddition(level);
        break;
      case 'subtraction':
        raw = generateSubtraction(level);
        break;
      case 'multiplication':
        raw = generateMultiplication(level);
        break;
      case 'division':
        raw = generateDivision(level);
        break;
    }

    const key = `${operation}:${raw.a}:${raw.b}`;
    const reverseKey =
      operation === 'addition' || operation === 'multiplication'
        ? `${operation}:${raw.b}:${raw.a}`
        : key;

    if (!recentKeys || (!recentKeys.has(key) && !recentKeys.has(reverseKey))) {
      recentKeys?.add(key);
      break;
    }
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    operation,
    level,
    a: raw.a,
    b: raw.b,
    expression: `${formatNum(raw.a)} ${symbol} ${formatNum(raw.b)}`,
    answer: raw.answer,
    strategy: raw.strategy,
    skillTag: raw.skillTag,
  };
}
