import { Directive, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';

/** Parses what a person types into a number field. Accepts "12,5" and "12.5"; unfinished input like "12." counts as 12. */
export function parseNumberText(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '' || clean === '.' || !/^\d*\.?\d*$/.test(clean)) return null;
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '';
}

/**
 * Text field for numbers that behaves well on phones.
 * `<input type="number">` bound two-way resets itself on intermediate states ("12.", an emptied field),
 * and it rejects decimal commas in some browser/locale combinations. This keeps what the user typed
 * untouched while they type and only rewrites the text when the model changes from somewhere else.
 */
@Directive({
  selector: 'input[appNum]',
  standalone: true,
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '(input)': 'onInput()',
    '(blur)': 'onBlur()',
  },
})
export class NumberInputDirective implements OnChanges {
  @Input() num: number | null | undefined = null;
  @Output() numChange = new EventEmitter<number | null>();

  private el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private initialised = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['num']) return;
    if (!this.initialised) {
      this.initialised = true;
      this.el.value = formatNumber(this.num);
      return;
    }
    // An emptied field counts as 0, so clearing it to type a new value doesn't snap back to "0".
    if ((parseNumberText(this.el.value) ?? 0) !== (this.num ?? 0)) this.el.value = formatNumber(this.num);
  }

  onInput(): void {
    this.numChange.emit(parseNumberText(this.el.value));
  }

  onBlur(): void {
    this.el.value = formatNumber(this.num);
  }
}
