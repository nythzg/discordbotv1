const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

registerFont(path.join(__dirname, '../../assets/Poppins-Regular.ttf'), {
    family: 'PoppinsLocalRegular'
});
registerFont(path.join(__dirname, '../../assets/Poppins-Bold.ttf'), {
    family: 'PoppinsLocalBold'
});

async function drawRankCard(username, discriminator, avatarUrl, level, currentXp, targetXp, rank) {
    const canvas = createCanvas(934, 282);
    const ctx = canvas.getContext('2d');

    // 1. Structural Slate Canvas Base background
    ctx.fillStyle = '#141518';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle container outline
    ctx.strokeStyle = '#2f3136';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // 2. Render Avatar Geometry
    let avatarImg;
    try {
        avatarImg = await loadImage(avatarUrl);
    } catch {
        // Fallback placeholder image if real one fails to fetch
        avatarImg = await loadImage('https://discord.com/assets/6f26eff52fc87c83f988.png');
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(141, 141, 85, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, 56, 56, 170, 170);
    ctx.restore();

    // 3. Username Rendering String Construction
    ctx.font = '38px PoppinsLocalBold';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(username, 270, 120);

    // 4. Metrics Text Calculation (Level / Rank Alignment)
    ctx.font = '28px PoppinsLocalBold';
    ctx.fillStyle = '#7289da';
    ctx.fillText(`RANK #${rank}`, 270, 175);

    ctx.fillStyle = '#43b581';
    ctx.fillText(`LEVEL ${level}`, 470, 175);

    // Progress Raw Values Text
    ctx.font = '24px PoppinsLocalRegular';
    ctx.fillStyle = '#b9bbbe';
    ctx.textAlign = 'right';
    const progressString = `${currentXp.toLocaleString()} / ${targetXp.toLocaleString()} XP`;
    ctx.fillText(progressString, 870, 175);

    // 5. Dynamic Progress Bar Math
    const barX = 270;
    const barY = 205;
    const barWidth = 600;
    const barHeight = 32;
    const radius = 16;
    const percentage = Math.max(0, Math.min(currentXp / targetXp, 1));

    // Outer Track bounding
    ctx.fillStyle = '#2f3136';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, radius);
    ctx.fill();

    // Foreground Fill progress tracking
    if (percentage > 0) {
        ctx.fillStyle = '#7289da';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * percentage, barHeight, radius);
        ctx.fill();
    }

    return canvas.toBuffer();
}

async function drawLevelUpCard(username, avatarUrl, level) {
    const canvas = createCanvas(900, 300);
    const ctx = canvas.getContext('2d');

    const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, '#111827');
    background.addColorStop(0.55, '#312e81');
    background.addColorStop(1, '#7c3aed');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(780, 20, 190, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(650, 310, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    let avatar = null;
    try {
        avatar = await loadImage(avatarUrl);
    } catch {
        // The initials placeholder below is used if Discord's avatar CDN is unavailable.
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 150, 92, 0, Math.PI * 2);
    ctx.clip();
    if (avatar) {
        ctx.drawImage(avatar, 58, 58, 184, 184);
    } else {
        ctx.fillStyle = '#5865f2';
        ctx.fillRect(58, 58, 184, 184);
        ctx.fillStyle = '#ffffff';
        ctx.font = '76px PoppinsLocalBold';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(username.slice(0, 1).toUpperCase(), 150, 150);
    }
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(150, 150, 95, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#c4b5fd';
    ctx.font = '25px PoppinsLocalBold';
    ctx.fillText('LEVEL UP!', 285, 82);

    ctx.fillStyle = '#ffffff';
    ctx.font = '46px PoppinsLocalBold';
    const displayName = username.length > 20 ? `${username.slice(0, 19)}…` : username;
    ctx.fillText(displayName, 285, 140);

    ctx.fillStyle = '#ddd6fe';
    ctx.font = '28px PoppinsLocalRegular';
    ctx.fillText('has reached', 285, 190);

    ctx.fillStyle = '#ffffff';
    ctx.font = '50px PoppinsLocalBold';
    ctx.fillText(`LEVEL ${level}`, 285, 250);

    return canvas.toBuffer('image/png');
}

module.exports = { drawRankCard, drawLevelUpCard };
