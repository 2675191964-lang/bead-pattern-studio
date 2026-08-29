import { expect, test } from '@playwright/test';

async function uploadRedPng(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 100, 100);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
    const input = document.querySelector<HTMLInputElement>('input[accept*="image/jpeg"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'solid-red-100.png', { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

test('上传 100×100 红图、生成 29×29、进入导出并保持手机无横向溢出', async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) remoteRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /把喜欢的画面/ })).toBeVisible();
  await uploadRedPng(page);
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole('button', { name: '生成拼豆图案' }).click();
  await expect(page.locator('.total-card strong')).toHaveText('841', { timeout: 20_000 });
  await expect(page.locator('.editor-statusbar')).toContainText('29 列 × 29 行');
  await expect(page.locator('.editor-statusbar')).toContainText('841 颗');
  await expect(page.getByLabel('拼豆图案画布')).toBeVisible();
  await page.getByRole('button', { name: '导出' }).click();
  await expect(page).toHaveURL(/\/export\//);
  await expect(page.locator('.integrity-check')).toContainText('841 = 分色合计 841 = CSV 必需量 841');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(remoteRequests).toEqual([]);
});

test('安装后的应用壳可离线打开深链帮助页', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  try {
    await context.setOffline(true);
    await page.goto('/help');
    await expect(page.getByRole('heading', { name: '从图片到施工图' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
