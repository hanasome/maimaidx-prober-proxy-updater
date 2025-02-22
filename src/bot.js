import config from "../config.js";
import { fetch as fetchWithCookie } from "node-fetch-cookies";
import { loadCookie } from "./wechat.js";

const fetch = async (cj, url, options, retry = 1) => {
  const result = await fetchWithCookie(cj, url, options);
  // console.log(result.url)
  if (result.url.indexOf("error") != -1 || await testCookieExpired(cj)) {
    if (retry === 3) {
      throw new Error("Cookie expired");
    }

    return await new Promise((resolve, reject) => {
      cj.load()
        .then(
          fetch(cj, url, options, retry + 1)
          .then(resolve)
          .catch(reject)
        )
        .catch(reject);
    })
  }

  const old = await loadCookie();
  if (
    cj.cookies?.get("maimai.wahlap.com")?.get("_t")?.value !==
      old.cookies?.get("maimai.wahlap.com")?.get("_t")?.value ||
    cj.cookies?.get("maimai.wahlap.com")?.get("userId")?.value !==
      old.cookies?.get("maimai.wahlap.com")?.get("userId")?.value
  ) {
    console.log("Cookies changes", cj.cookies, old.cookies)
    await cj.save();
  }
  return result;
};

const testCookieExpired = async (cj) => {
  const result = await fetchWithCookie(
    cj,
    "https://maimai.wahlap.com/maimai-mobile/home/"
  );
  const body = await result.text();
  console.log(body.indexOf("登录失败") !== -1);
  return body.indexOf("登录失败") !== -1;
};

const cancelFriendRequest = async (cj, friendCode) => {
  const result = await fetch(
    cj,
    "https://maimai.wahlap.com/maimai-mobile/friend/invite/cancel/",
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `idx=${friendCode}&token=${
        cj.cookies.get("maimai.wahlap.com").get("_t").value
      }&invite=`,
      method: "POST",
    }
  );
  cj.save(config.wechatLogin.cookiePath);
  // console.log(result);
};

const getSentRequests = async (cj) => {
  const result = await fetch(
    cj,
    "https://maimai.wahlap.com/maimai-mobile/friend/invite/"
  );
  const text = await result.text();
  const t = text.matchAll(/<input type="hidden" name="idx" value="(.*?)"/g);
  const ids = [...t].map((x) => x[1]);
  console.log(ids);
  return ids;
};

const favoriteOnFriend = async (cj, friendCode) => {
  const result = await fetch(
    cj,
    "https://maimai.wahlap.com/maimai-mobile/friend/favoriteOn/",
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `idx=${friendCode}&token=${
        cj.cookies.get("maimai.wahlap.com").get("_t").value
      }`,
      method: "POST",
    }
  );
};

const favoriteOffFriend = async (cj, friendCode) => {
  const result = await fetch(
    cj,
    "https://maimai.wahlap.com/maimai-mobile/friend/favoriteOff/",
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `idx=${friendCode}&token=${
        cj.cookies.get("maimai.wahlap.com").get("_t").value
      }`,
      method: "POST",
    }
  );
};

const getFriendVS = async (cj, friendCode, scoreType, diff) => {
  const url = `https://maimai.wahlap.com/maimai-mobile/friend/friendGenreVs/battleStart/?scoreType=${scoreType}&genre=99&diff=${diff}&idx=${friendCode}`;
  const result = await fetch(cj, url);
  return await result.text();
};

const getFriendList = async (cj) => {
  const url = "https://maimai.wahlap.com/maimai-mobile/index.php/friend/";
  const result = await fetch(cj, url);
  const text = await result.text();
  const t = text.matchAll(/<input type="hidden" name="idx" value="(.*?)"/g);
  const ids = [...new Set([...t].map((x) => x[1]))];
  // console.log(result);
  console.log(ids)
  return ids;
};

const removeFriend = async (cj, friendCode) => {
  const url =
    "https://maimai.wahlap.com/maimai-mobile/friend/friendDetail/drop/";
  const result = await fetch(cj, url, {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: `idx=${friendCode}&token=${
      cj.cookies.get("maimai.wahlap.com").get("_t").value
    }`,
    method: "POST",
  });
  // console.log(result);
};

const sendFriendRequest = async (cj, friendCode) => {
  const result1 = await fetch(
    cj,
    "https://maimai.wahlap.com/maimai-mobile/friend/search/invite/",
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `idx=${friendCode}&token=${
        cj.cookies.get("maimai.wahlap.com").get("_t").value
      }&invite=`,
      method: "POST",
    }
  );

  // console.log(result1);

  const result2 = await fetch(
    cj,
    "https://maimai.wahlap.com/maimai-mobile/index.php/friend/invite/"
  );

  // console.log(result2);
};

const updateScoreByVsPage = async (cj, friendCode, username, password) => {};

export {
  getFriendList,
  removeFriend,
  sendFriendRequest,
  updateScoreByVsPage,
  cancelFriendRequest,
  getSentRequests,
  testCookieExpired,
  favoriteOffFriend,
  favoriteOnFriend,
  getFriendVS,
};
