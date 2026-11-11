import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Lets the player keep a text file (backup, deck export).
 * - Web: a normal download (Blob link).
 * - Android (Capacitor): Blob downloads don't work in the WebView, so the file
 *   is written to the app cache and the system share sheet opens (save to
 *   Drive/Files, send by mail, …).
 */
export async function saveTextFile(name: string, text: string, mime: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({ title: name, files: [uri] })
    return
  }
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
