import * as cheerio from 'cheerio'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export const exportAnnotations = (csv) => {
  const blob = csv
    ? new Blob([generateCSVContent()], { type: 'text/csv' })
    : new Blob([generateEAFContent()], { type: 'text/eaf' })

  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = csv ? 'annotations.csv' : 'annotations.eaf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const frameToTimestamp = (frame, fps) => {
  const totalSecs = frame / fps
  const formattedHours = String(Math.floor(totalSecs / 60 / 60)).padStart(2, '0')
  const formattedMinutes = String(Math.floor(totalSecs / 60) % 60).padStart(2, '0')
  const formattedSeconds = String((totalSecs % 60).toFixed(3)).padStart(6, '0')
  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
}

const generateCSVContent = () => {
  return useUndoableStore()
    .timelines.filter((t) => t.type === 'shots')
    .flatMap((timeline) =>
      timeline.data.map((shot) => {
        const start = frameToTimestamp(shot.start, useMainStore().fps)
        const end = frameToTimestamp(shot.end, useMainStore().fps)
        return `"${timeline.name}"\t${start}\t${end}\t"${shot.annotation || ''}"\n`
      })
    )
    .join('')
}

const generateEAFContent = () => {
  let timeorder = '<TIME_ORDER>\n'
  let tiers = ''
  let timeslotid = 1
  let annotationid = 1

  useUndoableStore().timelines.forEach((t) => {
    if (t.type !== 'shots') return

    tiers += `<TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="${t.name}">\n`

    t.data.forEach((s) => {
      const start = Math.round((s.start / useMainStore().fps) * 1000)
      const end = Math.round((s.end / useMainStore().fps) * 1000)

      tiers += `
        <ANNOTATION>
            <ALIGNABLE_ANNOTATION ANNOTATION_ID="a${annotationid}"
                TIME_SLOT_REF1="ts${timeslotid}" TIME_SLOT_REF2="ts${timeslotid + 1}">
                <ANNOTATION_VALUE>${s.annotation || ''}</ANNOTATION_VALUE>
            </ALIGNABLE_ANNOTATION>
        </ANNOTATION>
      `
      annotationid++

      timeorder += `<TIME_SLOT TIME_SLOT_ID="ts${timeslotid}" TIME_VALUE="${start}"/>\n`
      timeorder += `<TIME_SLOT TIME_SLOT_ID="ts${timeslotid + 1}" TIME_VALUE="${end}"/>\n`
      timeslotid += 2
    })

    tiers += '</TIER>\n'
  })
  timeorder += '</TIME_ORDER>\n'

  const videoPath = useMainStore().video.replace('app://', '')
  return `
    <ANNOTATION_DOCUMENT AUTHOR="" DATE="2025-01-20T14:41:12+01:00"
      FORMAT="3.0" VERSION="3.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd">
      <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">
        <MEDIA_DESCRIPTOR
          MEDIA_URL="file:///${videoPath}"
          MIME_TYPE="video/mp4" />
        <PROPERTY NAME="lastUsedAnnotationId">0</PROPERTY>
      </HEADER>
      ${timeorder}
      ${tiers}
      <LINGUISTIC_TYPE GRAPHIC_REFERENCES="false"
        LINGUISTIC_TYPE_ID="default-lt" TIME_ALIGNABLE="true"/>
      <CONSTRAINT
        DESCRIPTION="Time subdivision of parent annotation's time interval, no time gaps allowed within this interval" STEREOTYPE="Time_Subdivision"/>
      <CONSTRAINT
        DESCRIPTION="Symbolic subdivision of a parent annotation. Annotations refering to the same parent are ordered" STEREOTYPE="Symbolic_Subdivision"/>
      <CONSTRAINT DESCRIPTION="1-1 association with a parent annotation" STEREOTYPE="Symbolic_Association"/>
      <CONSTRAINT
        DESCRIPTION="Time alignable annotations within the parent annotation's time interval, gaps are allowed" STEREOTYPE="Included_In"/>
    </ANNOTATION_DOCUMENT>
  `
}

export const parseEafAnnotations = (xmlContent) => {
  const xml = cheerio.load(xmlContent)
  const timemap = new Map()
  xml('TIME_SLOT').each((_, element) => {
    timemap.set(
      element.attribs.time_slot_id,
      Math.round((Number(element.attribs.time_value) / 1000) * useMainStore().fps)
    )
  })

  const timelines = new Map()
  xml('ALIGNABLE_ANNOTATION').each((_, element) => {
    const timelineId = element.parent.parent.attribs.tier_id
    if (!timelines.has(timelineId)) {
      timelines.set(timelineId, {
        name: timelineId,
        id: crypto.randomUUID(),
        data: [],
        type: 'shots'
      })
    }
    const text = xml(element).find('ANNOTATION_VALUE').text()
    timelines.get(timelineId).data.push({
      start: timemap.get(element.attribs.time_slot_ref1),
      end: timemap.get(element.attribs.time_slot_ref2),
      annotation: text,
      id: crypto.randomUUID()
    })
  })
  return [...timelines.values()]
}
