// 广告占位层：底部假 banner（播放中常驻，结算页隐藏）+ 结算页激励视频假卡
// 结构完整（banner 位/激励位/3 秒倒计时关闭），素材为本地自制假图，不接真实广告网络。

// banner 显示时抬高对话/选择层，避免压住
export function showBanner() {
  document.getElementById('adBanner').classList.remove('hidden');
  document.getElementById('app').classList.add('ad-on');
}

export function hideBanner() {
  document.getElementById('adBanner').classList.add('hidden');
  document.getElementById('app').classList.remove('ad-on');
}

// 广告素材可点：跳入戏官网（原生 <a> 新窗口，微信内置浏览器兼容最佳）；挡冒泡防推进剧情
for (const a of document.querySelectorAll('#adBanner a, #adInterstitial a')) {
  a.addEventListener('click', (e) => e.stopPropagation());
}

// 结算页挂激励视频假卡；点击走「点开 → 3 秒倒计时 → 关闭钮出现 → 关闭回结算」全流程
export function mountRewardedCard(slot) {
  slot.innerHTML = `
    <div class="ad-card" id="adCard" role="button" aria-label="激励视频广告占位">
      <span class="ad-badge">广告</span>
      <div class="ad-card-thumb">▶</div>
      <div class="ad-card-text">
        <div class="ad-card-title">看视频，领独家剧情卡</div>
        <div class="ad-card-sub">完整版《回山》七幕任意看</div>
      </div>
      <span class="ad-card-cta">观看</span>
    </div>`;
  slot.querySelector('#adCard').onclick = playInterstitial;
}

function playInterstitial() {
  const box = document.getElementById('adInterstitial');
  const count = document.getElementById('adiCount');
  const close = document.getElementById('adiClose');
  box.classList.remove('hidden');
  close.classList.add('hidden');
  let n = 3;
  count.textContent = n;
  count.classList.remove('hidden');
  const timer = setInterval(() => {
    n -= 1;
    if (n > 0) { count.textContent = n; return; }
    clearInterval(timer);
    count.classList.add('hidden');
    close.classList.remove('hidden'); // 倒计时走完才出现关闭钮
  }, 1000);
  close.onclick = (e) => { e.stopPropagation(); clearInterval(timer); box.classList.add('hidden'); }; // 关闭 → 回结算页
}
