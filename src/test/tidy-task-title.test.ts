import { describe, it, expect } from 'vitest';
import { tidyTaskTitle } from '@/lib/tidyTaskTitle';

describe('tidyTaskTitle', () => {
  it('trims surrounding whitespace', () => {
    expect(tidyTaskTitle('  modify website  ')).toBe('Modify website');
  });

  it('collapses internal double spaces', () => {
    expect(tidyTaskTitle('modify   the    website')).toBe('Modify the website');
  });

  it('capitalizes the first lowercase letter', () => {
    expect(tidyTaskTitle('modifying this website')).toBe('Modifying this website');
  });

  it('leaves already-capitalized text alone', () => {
    expect(tidyTaskTitle('Read AML paper')).toBe('Read AML paper');
  });

  it('does not touch the rest of the words', () => {
    expect(tidyTaskTitle('reply to BOSS email')).toBe('Reply to BOSS email');
  });

  it('leaves CJK untouched', () => {
    expect(tidyTaskTitle('  写  作业 ')).toBe('写 作业');
  });

  it('leaves numbers and emoji-leading text untouched at the front', () => {
    expect(tidyTaskTitle('3 pushups')).toBe('3 pushups');
  });

  it('returns empty string for blank or non-string input', () => {
    expect(tidyTaskTitle('   ')).toBe('');
    expect(tidyTaskTitle(null as unknown as string)).toBe('');
  });
});
