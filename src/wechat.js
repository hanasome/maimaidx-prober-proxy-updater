import { CookieJar } from "node-fetch-cookies";
import config from "../config.js";
import fetch from "node-fetch";
import fs from "fs";

async function refreshCookie() {
  for (let url of config.bot.trigger)  {
    console.log(`${url}/trigger?token=${config.wechatLogin.token}`)
    await fetch(`${url}/trigger?token=${config.wechatLogin.token}`);
  }

  for (let i = 0; i < 30; ++i) {
    const url = `${config.bot.target}/cookie?token=${config.wechatLogin.token}`;
    const result = await fetch(url);

    if (result.status === 200) {
      const cookieString = await (await fetch(url)).text();
      fs.writeFileSync(config.wechatLogin.cookiePath, cookieString, "utf8");
      return
    }

    console.log(result.status)
    // wait 10 seconds
    await new Promise((r) => {
      setTimeout(r, 1000 * 10);
    });
  }

  throw new Error("Failed to refresh cookie");
}

async function loadCookie() {
  const cj = new CookieJar(config.wechatLogin.cookiePath);
  try {
    await cj.load();
    return cj;
  }
  catch (err) {
    return new CookieJar()
  }
}

export { refreshCookie, loadCookie };
