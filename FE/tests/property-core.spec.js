import { test, expect } from "@playwright/test";
async function login(page, email = "owner@test.local") {
  await page.goto("/");
  await page.getByLabel("Địa chỉ email").fill(email);
  await page.getByLabel(/^Mật khẩu/).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Danh sách cơ sở" }),
  ).toBeVisible();
}
test("landlord creates branch, bulk rooms, lease, termination and survives refresh", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.screenshot({
    path: "test-results/branches-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Thêm cơ sở", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Tên cơ sở").fill("Cơ sở E2E");
  await page.getByLabel("Số tầng").fill("2");
  await page.getByLabel("Địa chỉ").fill("25 Nguyễn Trãi, TP. Hồ Chí Minh");
  await page.getByRole("button", { name: "Lưu cơ sở" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Cơ sở E2E", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sơ đồ phòng" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sinh phòng nhanh" }).click();
  await page.getByLabel("Số phòng kết thúc").fill("103");
  await page.getByLabel("Giá thuê niêm yết").fill("3000000");
  await page.getByRole("button", { name: "Tạo các phòng" }).click();
  await expect(
    page.getByRole("heading", { name: "P.203", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/rooms-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".room-card")
    .filter({ has: page.getByRole("heading", { name: "P.101", exact: true }) })
    .getByRole("link", { name: "Lập hợp đồng" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Họ và tên").fill("Nguyễn Minh An");
  await page.getByLabel("Số điện thoại").fill("0901111222");
  await page.getByLabel("Email").fill("e2e-tenant@test.local");
  await page.getByLabel("CCCD / CMND").fill("001234567899");
  await page.getByLabel("Ngày bắt đầu").fill("2026-01-01");
  await page.getByLabel("Ngày kết thúc").fill("2027-12-31");
  await page.getByLabel("Tiền thuê (₫/tháng)").fill("3000000");
  await page.getByLabel("Tiền cọc (₫)").fill("3000000");
  await page.getByLabel("Tình trạng nhận cọc").selectOption("PAID");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tạo hợp đồng", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Nguyễn Minh An")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Nguyễn Minh An")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page.getByText("Nguyễn Minh An").click();
  await page.getByRole("button", { name: "Thanh lý hợp đồng" }).click();
  await page
    .getByLabel("Link ảnh đồng hồ điện")
    .fill("https://example.com/electric.jpg");
  await page
    .getByLabel("Link ảnh đồng hồ nước")
    .fill("https://example.com/water.jpg");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Xác nhận thanh lý" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("tbody").getByText("Đã thanh lý")).toBeVisible();
  await page.screenshot({
    path: "test-results/contracts-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile manager sees assigned branch only and can change operational status", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await login(page, "manager@test.local");
  await expect(
    page.getByRole("link", { name: "Cơ sở ngoài phân công" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Thêm cơ sở", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Cơ sở Vườn Xanh", exact: true })
    .click();
  await page.getByRole("button", { name: "Sửa phòng A.101" }).click();
  await page.getByLabel("Trạng thái vận hành").selectOption("MAINTENANCE");
  await page.getByRole("button", { name: "Lưu phòng" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator(".room-card").getByText("Đang bảo trì"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/rooms-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập tài khoản" }),
  ).toBeVisible();
});
