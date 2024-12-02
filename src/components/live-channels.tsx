'use client'

import { CalendarClock, CheckIcon, ChevronsUpDownIcon, Tv } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { fetchFromApi, getStreamUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { VideoPlayer } from '@/components/video-player'

import { Programme } from '@/types'

interface Channel {
  num: number
  name: string
  stream_type: string
  stream_id: number
  stream_icon: string
  epg_channel_id: string
  added: string
  category_id: string
  custom_sid: string
  tv_archive: number
  direct_source: string
  tv_archive_duration: number
}

interface Category {
  category_id: string
  category_name: string
  parent_id: number
}

export function LiveChannels() {
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [categorySelectOpen, setCategorySelectOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [streamUrl, setStreamUrl] = useState<string>('')
  const [isChrome, setIsChrome] = useState(false)
  const [showEpg, setShowEpg] = useState(false)
  const [epgData, setEpgData] = useState<Programme[]>([])
  const [loadingEpg, setLoadingEpg] = useState(false)
  const [selectedTimezone, setSelectedTimezone] = useState(() => {
    // Try to get saved timezone from localStorage, default to 1 if not found
    if (typeof window !== 'undefined') {
      const savedTimezone = localStorage.getItem('selectedTimezone')
      return savedTimezone ? parseInt(savedTimezone) : 1
    }
    return 1
  })
  const [selectedTimezoneValue, setSelectedTimezoneValue] = useState(
    selectedTimezone.toString()
  )
  const liveEventRef = useRef<HTMLDivElement>(null)

  const timezones = [
    { offset: -12, name: 'Baker Island (GMT-12)' },
    { offset: -11, name: 'American Samoa (GMT-11)' },
    { offset: -10, name: 'Hawaii (GMT-10)' },
    { offset: -9, name: 'Alaska (GMT-9)' },
    { offset: -8, name: 'Pacific Time (GMT-8)' },
    { offset: -7, name: 'Mountain Time (GMT-7)' },
    { offset: -6, name: 'Central Time (GMT-6)' },
    { offset: -5, name: 'Eastern Time (GMT-5)' },
    { offset: -4, name: 'Atlantic Time (GMT-4)' },
    { offset: -3, name: 'Buenos Aires (GMT-3)' },
    { offset: -2, name: 'South Georgia (GMT-2)' },
    { offset: -1, name: 'Cape Verde (GMT-1)' },
    { offset: 0, name: 'London (GMT+0)' },
    { offset: 1, name: 'Paris, Berlin (GMT+1)' },
    { offset: 2, name: 'Cairo, Athens (GMT+2)' },
    { offset: 3, name: 'Moscow (GMT+3)' },
    { offset: 4, name: 'Dubai (GMT+4)' },
    { offset: 5, name: 'Karachi (GMT+5)' },
    { offset: 6, name: 'Dhaka (GMT+6)' },
    { offset: 7, name: 'Bangkok (GMT+7)' },
    { offset: 8, name: 'Singapore, Beijing (GMT+8)' },
    { offset: 9, name: 'Tokyo (GMT+9)' },
    { offset: 10, name: 'Sydney (GMT+10)' },
    { offset: 11, name: 'Solomon Islands (GMT+11)' },
    { offset: 12, name: 'Auckland (GMT+12)' },
  ]

  const adjustTimeToTimezone = (
    date: Date,
    fromOffset: number,
    toOffset: number
  ) => {
    const diffHours = toOffset - fromOffset
    return new Date(date.getTime() + diffHours * 60 * 60 * 1000)
  }

  function formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `${day}-${month}-${year} ${hours}:${minutes}`
  }

  useEffect(() => {
    // Check if browser is Chrome
    const userAgent = window.navigator.userAgent
    setIsChrome(userAgent.indexOf('Chrome') > -1)
  }, [])

  // Fetch categories first
  useEffect(() => {
    async function fetchCategories() {
      try {
        const categoriesData = await fetchFromApi('get_live_categories')
        setCategories(categoriesData)
        if (categoriesData.length > 0) {
          setSelectedCategory(categoriesData[0].category_id)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    fetchCategories()
  }, [])

  // Fetch channels when category changes
  useEffect(() => {
    async function fetchChannels() {
      if (!selectedCategory) return

      setLoading(true)
      try {
        const channelsData = await fetchFromApi('get_live_streams', {
          category_id: selectedCategory,
        })
        setChannels(channelsData)
      } catch (error) {
        console.error('Failed to fetch channels:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchChannels()
  }, [selectedCategory])

  useEffect(() => {
    async function fetchStreamUrl() {
      if (selectedChannel) {
        try {
          const url = await getStreamUrl(selectedChannel.stream_id, 'live')
          setStreamUrl(url)
        } catch (error) {
          console.error('Failed to fetch stream URL:', error)
        }
      }
    }
    fetchStreamUrl()
  }, [selectedChannel])

  // Fetch EPG data when channel changes
  useEffect(() => {
    async function fetchEpgData() {
      if (!selectedChannel?.epg_channel_id) return

      setLoadingEpg(true)
      try {
        const response = await fetch(
          '/api/epg?stream_id=' + selectedChannel.stream_id
        )
        if (!response.ok) throw new Error('Failed to fetch EPG data')
        const data = await response.json()
        setEpgData(data.epg_listings || [])
      } catch (error) {
        console.error('Failed to fetch EPG data:', error)
      } finally {
        setLoadingEpg(false)
      }
    }
    fetchEpgData()
  }, [selectedChannel?.epg_channel_id])

  useEffect(() => {
    if (showEpg && !loadingEpg && epgData.length > 0 && liveEventRef.current) {
      // Add a small delay to ensure content is rendered
      setTimeout(() => {
        liveEventRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 100)
    }
  }, [showEpg, loadingEpg, epgData])

  const searchedChannels = searchQuery
    ? channels.filter((channel) =>
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channels

  const handleTimezoneChange = (value: string) => {
    const timezone = parseInt(value)
    setSelectedTimezone(timezone)
    localStorage.setItem('selectedTimezone', timezone.toString())
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[350px,1fr] md:grid-cols-[300px,1fr] gap-4 md:gap-6 p-4">
      <div className="flex flex-col space-y-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-4 space-y-4">
            <Popover
              open={categorySelectOpen}
              onOpenChange={setCategorySelectOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    'justify-between relative w-full',
                    !selectedCategory && 'text-muted-foreground'
                  )}
                >
                  {selectedCategory
                    ? categories.find(
                        (category) => category.category_id === selectedCategory
                      )?.category_name
                    : 'Select Category'}
                  <ChevronsUpDownIcon className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 w-full">
                <Command>
                  <CommandInput
                    placeholder="Search Category..."
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>No categories found.</CommandEmpty>
                    <CommandGroup>
                      {categories.map((category) => (
                        <CommandItem
                          value={category.category_name}
                          key={category.category_id}
                          onSelect={() => {
                            setSelectedCategory(category.category_id)
                            setCategorySelectOpen(false)
                          }}
                        >
                          {category.category_name}
                          <CheckIcon
                            className={cn(
                              'ml-auto',
                              selectedCategory === category.category_id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="p-4 space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              ) : searchedChannels.length === 0 ? (
                <p className="text-center text-muted-foreground p-4">
                  No channels found
                </p>
              ) : (
                searchedChannels.map((channel) => (
                  <button
                    key={channel.stream_id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`flex items-center space-x-3 w-full p-2 rounded-md hover:bg-accent transition-colors ${
                      selectedChannel?.stream_id === channel.stream_id
                        ? 'bg-accent'
                        : ''
                    }`}
                  >
                    <Tv className="w-8 h-8 flex-shrink-0" />
                    <span className="text-sm text-left line-clamp-2">
                      {channel.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="space-y-4">
        {isChrome && (
          <Alert
            variant="destructive"
            className="bg-yellow-50 dark:bg-yellow-900/20"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Some channels may not work properly in Chrome. For the best
              experience, consider using Firefox or another browser.
            </AlertDescription>
          </Alert>
        )}
        {selectedChannel ? (
          <>
            <div className="rounded-lg overflow-hidden">
              <VideoPlayer src={streamUrl} autoPlay={true} />
            </div>
            <div className="flex justify-between items-center">
              <h2 className="text-xl md:text-2xl font-bold">
                {selectedChannel.name}
              </h2>
              {selectedChannel.epg_channel_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEpg(true)}
                >
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Show EPG
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="aspect-video bg-accent rounded-lg flex items-center justify-center">
            <p className="text-lg text-center px-4">
              Select a channel to start watching
            </p>
          </div>
        )}
      </div>

      <Dialog open={showEpg} onOpenChange={setShowEpg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TV Guide - {selectedChannel?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4">
              <Select
                value={selectedTimezone.toString()}
                onValueChange={handleTimezoneChange}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[300px]">
                    {timezones.map((tz) => (
                      <SelectItem key={tz.offset} value={tz.offset.toString()}>
                        {tz.name}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            {loadingEpg ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : epgData.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No EPG data available
              </p>
            ) : (
              <ScrollArea className="h-[60vh]">
                <div className="space-y-3">
                  {epgData.map((programme, index) => {
                    const baseStart = new Date(programme.start)
                    const baseEnd = new Date(programme.end)

                    // Adjust times from GMT+1 to selected timezone
                    const start = adjustTimeToTimezone(
                      baseStart,
                      0,
                      selectedTimezone
                    )
                    const end = adjustTimeToTimezone(
                      baseEnd,
                      0,
                      selectedTimezone
                    )
                    const isLive = new Date() >= start && new Date() <= end

                    return (
                      <div
                        key={index}
                        ref={isLive ? liveEventRef : undefined}
                        className={`p-3 rounded-lg border ${
                          isLive ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{formatDate(start)}</span>
                          <span>{formatDate(end)}</span>
                        </div>
                        <h3 className="font-medium mt-1">
                          {atob(programme.title) || programme.title}
                        </h3>
                        {programme.desc && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {atob(programme.desc) || programme.desc}
                          </p>
                        )}
                        {isLive && (
                          <div className="mt-2">
                            <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-1 rounded">
                              LIVE NOW
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
